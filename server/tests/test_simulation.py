import json
import random
import sys
import unittest
from copy import deepcopy
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))
from app.simulation.engine import (SimulationError, advance, cancel_order, finish,
                                   new_session, public_view, submit_order, amount)


def order(**changes):
    result = {"symbol": "NORTH", "side": "buy", "type": "market", "quantity": 20,
              "plan": {"reason": "Compare a small position with the passive basket.",
                       "risk": "Prices may fall before I need to sell this position.",
                       "exit": "Reconsider after ten observations or a changed premise.",
                       "size_reason": "Keep this example position well below the concentration cap.",
                       "max_loss": "1000"}}
    result.update(changes)
    return result


class SimulationTests(unittest.TestCase):
    def test_seed_is_deterministic_and_global_random_is_untouched(self):
        random.seed(55)
        before = random.getstate()
        a = new_session(10, "volatile")
        new_session(999, "rising")
        b = new_session(10, "volatile")
        self.assertEqual(a, b)
        self.assertEqual(before, random.getstate())
        self.assertNotEqual(a["prices"], new_session(11, "volatile")["prices"])

    def test_public_view_hides_all_future_values_and_scenario_direction(self):
        s = new_session(7, "falling")
        view = public_view(s)
        self.assertNotIn("seed", view)
        self.assertNotIn("kind", view)
        self.assertNotIn("prices", view)
        self.assertEqual([len(v) for v in view["history"].values()], [1] * 4)
        advance(s, 3)
        self.assertEqual([len(v) for v in public_view(s)["history"].values()], [4] * 4)

    def test_plan_quantity_and_concentration_are_enforced_without_mutation(self):
        s = new_session(1)
        for request in [order(plan=None), order(quantity=True), order(quantity=0),
                        order(quantity=1000), order(plan={}), order(type="unsupported")]:
            before = deepcopy(s)
            with self.assertRaises(SimulationError):
                submit_order(s, request)
            self.assertEqual(s, before)
        request = order()
        request["plan"]["max_loss"] = "NaN"
        with self.assertRaises(SimulationError):
            submit_order(s, request)

    def test_market_fills_on_next_tick_with_partial_capacity_and_fees(self):
        s = new_session(1)
        s["prices"]["NORTH"] = ["40.00"] * 120
        s["liquidity"]["NORTH"] = [3] * 120
        submit_order(s, order(quantity=5))
        self.assertEqual(s["fills"], [])
        advance(s)
        self.assertEqual(s["orders"][0]["status"], "partial")
        self.assertEqual(s["fills"][0]["quantity"], 3)
        self.assertEqual(s["fills"][0]["price"], "40.06")
        self.assertEqual(s["fills"][0]["fee"], "0.37")
        advance(s)
        self.assertEqual(s["orders"][0]["status"], "filled")
        self.assertEqual(s["positions"]["NORTH"]["quantity"], 5)
        self.assertEqual(s["fills"][1]["fee"], "0.08")
        self.assertEqual(s["fees"], "0.45")
        self.assertEqual(s["cash"], "9799.27")

    def test_limit_never_exceeds_price_and_unreached_order_waits(self):
        s = new_session(1)
        s["prices"]["NORTH"] = ["40.00"] * 120
        low = submit_order(s, order(type="limit", price="39", quantity=1))
        fill = submit_order(s, order(type="limit", price="40.04", quantity=1))
        advance(s)
        self.assertEqual(s["orders"][0]["status"], "open")
        self.assertEqual(s["orders"][1]["status"], "filled")
        self.assertLessEqual(amount(s["fills"][0]["price"]), amount("40.04"))
        self.assertNotEqual(low["id"], fill["id"])

    def test_subcent_limits_and_plan_boundaries_are_rejected(self):
        s = new_session(1)
        with self.assertRaises(SimulationError):
            submit_order(s, order(type="limit", price="39.999", quantity=1))
        request = order()
        request["plan"]["max_loss"] = "100.001"
        with self.assertRaises(SimulationError):
            submit_order(s, request)
        self.assertEqual(s["orders"], [])

    def test_partial_order_does_not_reserve_the_initial_fee_again(self):
        from app.simulation.engine import reserved_cash
        s = new_session(1)
        s["liquidity"]["NORTH"][1] = 1
        submit_order(s, order(quantity=3))
        advance(s)
        remaining = s["orders"][0]
        self.assertEqual(reserved_cash(s), amount(remaining["reservation_per_unit"]) * 2)

    def test_stop_can_gap_and_does_not_guarantee_trigger_price(self):
        s = new_session(1)
        s["prices"]["NORTH"] = ["40.00", "40.00", "30.00"] + ["30.00"] * 117
        submit_order(s, order(quantity=1))
        advance(s)
        submit_order(s, order(side="sell", type="stop", price="38", quantity=1))
        advance(s)
        self.assertLess(amount(s["fills"][-1]["price"]), amount("38"))
        self.assertEqual(s["positions"]["NORTH"]["quantity"], 0)

    def test_cancel_releases_shares_and_cash_reservations(self):
        s = new_session(1)
        submitted = submit_order(s, order(type="limit", price="1", quantity=20))
        self.assertLess(amount(public_view(s)["available_cash"]), amount(s["cash"]))
        cancel_order(s, submitted["id"])
        self.assertEqual(public_view(s)["available_cash"], s["cash"])
        submit_order(s, order(quantity=1))
        advance(s)
        reserved = submit_order(s, order(side="sell", type="limit", price="1000", quantity=1))
        with self.assertRaises(SimulationError):
            submit_order(s, order(side="sell", quantity=1))
        cancel_order(s, reserved["id"])
        submit_order(s, order(side="sell", quantity=1))

    def test_json_resume_matches_uninterrupted_execution(self):
        a = new_session(10)
        submit_order(a, order(quantity=17))
        advance(a, 5)
        b = json.loads(json.dumps(a))
        for _ in range(4):
            advance(a, 5)
            advance(b, 5)
        self.assertEqual(a, b)
        self.assertEqual(public_view(a), public_view(b))

    def test_shared_liquidity_cannot_be_filled_twice(self):
        s = new_session(4)
        s["liquidity"]["NORTH"][1] = 3
        submit_order(s, order(quantity=3))
        submit_order(s, order(quantity=3))
        advance(s)
        self.assertEqual(sum(f["quantity"] for f in s["fills"]), 3)
        self.assertEqual(s["orders"][1]["filled"], 0)

    def test_end_of_path_expires_orders_and_reflection_does_not_require_trade(self):
        s = new_session(3, ticks=20)
        submit_order(s, order(type="limit", price="1", quantity=1))
        for _ in range(4):
            advance(s, 5)
        self.assertEqual(s["orders"][0]["status"], "expired")
        finish(s, "I chose to leave the limit order unfilled rather than raise my intended price.")
        self.assertTrue(s["finished"])
        self.assertEqual(s["fills"], [])
        self.assertEqual(s["cash"], "10000.00")
        with self.assertRaises(SimulationError):
            advance(s)

    def test_no_shorting_or_credit_and_state_remains_nonnegative(self):
        s = new_session(15, "volatile")
        with self.assertRaises(SimulationError):
            submit_order(s, order(side="sell", quantity=1))
        for symbol in ("NORTH", "HARBOR", "PLAIN", "COVE"):
            submit_order(s, order(symbol=symbol, quantity=10))
        for _ in range(24):
            advance(s, 5)
            self.assertGreaterEqual(amount(s["cash"]), 0)
            for position in s["positions"].values():
                self.assertGreaterEqual(position["quantity"], 0)


if __name__ == "__main__":
    unittest.main()
