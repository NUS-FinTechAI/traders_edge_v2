from __future__ import annotations

from copy import deepcopy
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
import random
from typing import Any

VERSION = 1
SYMBOLS = ("NORTH", "HARBOR", "PLAIN", "COVE")
KINDS = ("rising", "falling", "sideways", "volatile")
CENT = Decimal("0.01")
FEE_RATE = Decimal("0.001")
OPEN_FEE = Decimal("0.25")


class SimulationError(ValueError):
    pass


def amount(value: Any) -> Decimal:
    try:
        result = Decimal(str(value))
    except Exception as exc:
        raise SimulationError("Enter a valid amount.") from exc
    if not result.is_finite() or abs(result) > Decimal("1e15"):
        raise SimulationError("Enter a finite amount within the supported range.")
    return result


def money(value: Any) -> str:
    return str(amount(value).quantize(CENT, rounding=ROUND_HALF_UP))


def cents(value: Any) -> Decimal:
    result = amount(value)
    if result != result.quantize(CENT, rounding=ROUND_HALF_UP):
        raise SimulationError("Use amounts with no more than two decimal places.")
    return result


def new_session(seed: int, kind: str = "sideways", ticks: int = 120) -> dict:
    if kind not in KINDS or not 20 <= ticks <= 240:
        raise SimulationError("Unknown scenario or invalid length.")
    rng = random.Random(seed)
    prices: dict[str, list[str]] = {}
    liquidity: dict[str, list[int]] = {}
    drift = {"rising": 0.0015, "falling": -0.0015, "sideways": 0, "volatile": 0}[kind]
    volatility = 0.025 if kind == "volatile" else 0.006
    for index, symbol in enumerate(SYMBOLS):
        price = Decimal(40 + index * 30)
        prices[symbol] = [money(price)]
        liquidity[symbol] = [rng.randint(3, 12)]
        for _ in range(1, ticks):
            change = Decimal(str(drift + rng.gauss(0, volatility)))
            price = max(Decimal("1"), price * (1 + change)).quantize(CENT)
            prices[symbol].append(money(price))
            liquidity[symbol].append(rng.randint(3, 12))
    return {
        "version": VERSION, "seed": seed, "kind": kind, "tick": 0,
        "prices": prices, "liquidity": liquidity, "cash": "10000.00",
        "initial_cash": "10000.00", "positions": {}, "orders": [],
        "fills": [], "fees": "0.00", "equity_history": ["10000.00"],
        "finished": False, "reflection": None,
    }


def quote(state: dict, symbol: str) -> dict:
    if symbol not in SYMBOLS:
        raise SimulationError("Unknown example asset.")
    mid = amount(state["prices"][symbol][state["tick"]])
    spread = mid * Decimal("0.002")
    return {"symbol": symbol, "mid": money(mid), "bid": money(mid - spread / 2),
            "ask": money(mid + spread / 2), "available_units": state["liquidity"][symbol][state["tick"]]}


def equity(state: dict) -> Decimal:
    return amount(state["cash"]) + sum(
        amount(position["quantity"]) * amount(quote(state, symbol)["mid"])
        for symbol, position in state["positions"].items()
    )


def pending(order: dict) -> bool:
    return order["status"] in ("open", "partial")


def reserved_cash(state: dict, except_id: str | None = None) -> Decimal:
    return sum((amount(o["reservation_per_unit"]) * o["remaining"] + (OPEN_FEE if o["filled"] == 0 else Decimal(0))
                for o in state["orders"] if pending(o) and o["side"] == "buy"
                and o["id"] != except_id), Decimal(0))


def _text(value: Any, label: str, minimum: int = 12) -> str:
    if not isinstance(value, str) or not minimum <= len(value.strip()) <= 1500:
        raise SimulationError(f"Write {minimum}–1500 characters for {label}.")
    return value.strip()


def submit_order(state: dict, request: dict) -> dict:
    if state["finished"] or state["tick"] >= len(state["prices"][SYMBOLS[0]]) - 1:
        raise SimulationError("This scenario no longer accepts orders.")
    symbol, side, order_type = request.get("symbol"), request.get("side"), request.get("type")
    if symbol not in SYMBOLS or side not in ("buy", "sell") or order_type not in ("market", "limit", "stop"):
        raise SimulationError("Choose an example asset, side and supported order type.")
    quantity = request.get("quantity")
    if isinstance(quantity, bool) or not isinstance(quantity, int) or not 1 <= quantity <= 1000:
        raise SimulationError("Quantity must be a whole number from 1 to 1000.")
    plan = request.get("plan")
    if not isinstance(plan, dict):
        raise SimulationError("Write a plan before submitting an order.")
    plan = {"reason": _text(plan.get("reason"), "your reason"),
            "risk": _text(plan.get("risk"), "what could go wrong"),
            "exit": _text(plan.get("exit"), "when you would reconsider"),
            "size_reason": _text(plan.get("size_reason"), "your position-size reasoning"),
            "max_loss": money(cents(plan.get("max_loss", 0)))}
    if not 0 < amount(plan["max_loss"]) <= equity(state):
        raise SimulationError("Set a positive planned loss boundary within your example portfolio value.")
    threshold = None
    if order_type in ("limit", "stop"):
        threshold = cents(request.get("price", 0))
        if not Decimal("0.01") <= threshold <= Decimal("1000000"):
            raise SimulationError("Enter a positive limit or stop price.")
    current = quote(state, symbol)
    estimate = threshold if order_type == "limit" else amount(current["ask"]) * Decimal("1.05")
    reservation = estimate * (1 + FEE_RATE)
    if side == "buy":
        current_value = amount(current["mid"]) * state["positions"].get(symbol, {}).get("quantity", 0)
        pending_value = sum(amount(o["reservation_per_unit"]) * o["remaining"] for o in state["orders"]
                            if pending(o) and o["side"] == "buy" and o["symbol"] == symbol)
        if current_value + pending_value + reservation * quantity > equity(state) * Decimal("0.25"):
            raise SimulationError("This foundation scenario caps each asset at 25% of portfolio value.")
        if reservation * quantity + OPEN_FEE > amount(state["cash"]) - reserved_cash(state):
            raise SimulationError("There is not enough unreserved cash for this order.")
    else:
        held = state["positions"].get(symbol, {}).get("quantity", 0)
        reserved = sum(o["remaining"] for o in state["orders"]
                       if pending(o) and o["side"] == "sell" and o["symbol"] == symbol)
        if quantity > held - reserved:
            raise SimulationError("Sell only units you hold and have not reserved in another order.")
    order = {"id": f"order-{len(state['orders']) + 1}", "symbol": symbol, "side": side,
             "type": order_type, "quantity": quantity, "remaining": quantity,
             "price": money(threshold) if threshold is not None else None,
             "plan": plan, "status": "open", "submitted_tick": state["tick"],
             "triggered": False, "filled": 0, "reservation_per_unit": money(reservation)}
    state["orders"].append(order)
    return deepcopy(order)


def cancel_order(state: dict, order_id: str) -> dict:
    order = next((o for o in state["orders"] if o["id"] == order_id), None)
    if order is None:
        raise SimulationError("Order not found.")
    if not pending(order):
        raise SimulationError("Only an open or partially filled order can be cancelled.")
    order["status"] = "cancelled"
    return deepcopy(order)


def _fill(state: dict, order: dict, capacities: dict[str, int]) -> None:
    symbol, side = order["symbol"], order["side"]
    q = quote(state, symbol)
    threshold = amount(order["price"]) if order["price"] is not None else None
    market_price = amount(q["ask"] if side == "buy" else q["bid"])
    if order["type"] == "stop" and not order["triggered"]:
        order["triggered"] = amount(q["mid"]) >= threshold if side == "buy" else amount(q["mid"]) <= threshold
        if not order["triggered"]:
            return
    if order["type"] == "limit" and (market_price > threshold if side == "buy" else market_price < threshold):
        return
    units = min(order["remaining"], capacities[symbol])
    if units == 0:
        return
    impact = market_price * Decimal("0.0005") * amount(units) / max(1, q["available_units"])
    price = market_price + impact if side == "buy" else market_price - impact
    if order["type"] == "limit":
        price = min(price, threshold) if side == "buy" else max(price, threshold)
    price = amount(money(price))
    first_fee = OPEN_FEE if order["filled"] == 0 else Decimal(0)
    if side == "buy":
        available = amount(state["cash"]) - reserved_cash(state, order["id"]) - first_fee
        affordable = int(max(Decimal(0), available / (price * (1 + FEE_RATE))).to_integral_value(rounding=ROUND_DOWN))
        current_value = state["positions"].get(symbol, {}).get("quantity", 0) * amount(q["mid"])
        exposure_room = max(Decimal(0), equity(state) * Decimal("0.25") - current_value)
        units = min(units, affordable, int(exposure_room / price))
        if units <= 0:
            order["status"] = "rejected"
            order["reason"] = "The changed price exceeds available cash or the exposure limit."
            return
    fee = amount(money(price * units * FEE_RATE + first_fee))
    gross = price * units
    position = state["positions"].setdefault(symbol, {"quantity": 0, "cost": "0.00", "realized": "0.00"})
    if side == "buy":
        state["cash"] = money(amount(state["cash"]) - gross - fee)
        position["quantity"] += units
        position["cost"] = money(amount(position["cost"]) + gross + fee)
    else:
        average = amount(position["cost"]) / position["quantity"]
        removed_cost = average * units
        position["quantity"] -= units
        position["cost"] = money(amount(position["cost"]) - removed_cost)
        position["realized"] = money(amount(position["realized"]) + gross - fee - removed_cost)
        state["cash"] = money(amount(state["cash"]) + gross - fee)
    state["fees"] = money(amount(state["fees"]) + fee)
    order["remaining"] -= units
    order["filled"] += units
    order["status"] = "filled" if order["remaining"] == 0 else "partial"
    capacities[symbol] -= units
    state["fills"].append({"order_id": order["id"], "tick": state["tick"], "symbol": symbol,
                           "side": side, "quantity": units, "price": money(price), "fee": money(fee)})


def advance(state: dict, steps: int = 1) -> dict:
    if isinstance(steps, bool) or not isinstance(steps, int) or not 1 <= steps <= 5:
        raise SimulationError("Advance one to five observations at a time.")
    if state["finished"]:
        raise SimulationError("This scenario has ended.")
    last = len(state["prices"][SYMBOLS[0]]) - 1
    for _ in range(min(steps, last - state["tick"])):
        state["tick"] += 1
        capacities = {s: state["liquidity"][s][state["tick"]] for s in SYMBOLS}
        for order in state["orders"]:
            if pending(order):
                _fill(state, order, capacities)
        state["equity_history"].append(money(equity(state)))
    if state["tick"] == last:
        for order in state["orders"]:
            if pending(order):
                order["status"] = "expired"
    return public_view(state)


def finish(state: dict, reflection: str) -> dict:
    if state["finished"]:
        raise SimulationError("This scenario already has a reflection.")
    if state["tick"] < 10:
        raise SimulationError("Observe at least ten market steps before reflecting.")
    state["reflection"] = _text(reflection, "your reflection", 30)
    state["finished"] = True
    for order in state["orders"]:
        if pending(order):
            order["status"] = "cancelled"
    return public_view(state)


def public_view(state: dict) -> dict:
    if state["version"] != VERSION:
        raise SimulationError("Unsupported saved scenario version.")
    value = equity(state)
    peak, drawdown = amount(state["initial_cash"]), Decimal(0)
    for item in state["equity_history"]:
        current = amount(item)
        peak = max(peak, current)
        drawdown = max(drawdown, (peak - current) / peak)
    # Comparison assumes an equal-value fractional basket held from the first observation.
    benchmark = sum(amount(state["initial_cash"]) / len(SYMBOLS)
                    * amount(quote(state, s)["mid"]) / amount(state["prices"][s][0]) for s in SYMBOLS)
    orders = [{k: deepcopy(v) for k, v in order.items() if k != "reservation_per_unit"}
              for order in state["orders"]]
    positions = [{"symbol": symbol, **deepcopy(position),
                  "value": money(position["quantity"] * amount(quote(state, symbol)["mid"])),
                  "weight_percent": money(position["quantity"] * amount(quote(state, symbol)["mid"]) / value * 100)}
                 for symbol, position in state["positions"].items() if position["quantity"]]
    return {"version": VERSION, "tick": state["tick"], "total_ticks": len(state["prices"][SYMBOLS[0]]),
            "scenario": "Controlled synthetic practice", "finished": state["finished"],
            "cash": state["cash"], "available_cash": money(max(Decimal(0), amount(state["cash"]) - reserved_cash(state))),
            "equity": money(value), "fees": state["fees"], "positions": positions, "orders": orders,
            "quotes": [quote(state, s) for s in SYMBOLS], "fills": deepcopy(state["fills"]),
            "history": {s: state["prices"][s][:state["tick"] + 1] for s in SYMBOLS},
            "benchmark_value": money(benchmark), "max_drawdown_percent": money(drawdown * 100),
            "reflection": state["reflection"],
            "rules": {"max_asset_weight_percent": 25, "shorting": False, "leverage": 1,
                      "fee_rate": str(FEE_RATE), "first_fill_fee": str(OPEN_FEE),
                      "spread_percent": "0.2", "settlement": "Immediate educational accounting; no jurisdiction-specific settlement model",
                      "benchmark": "Equal-value buy-and-hold basket; fractional units, gross of fees. Context only, never a reward score."}}
