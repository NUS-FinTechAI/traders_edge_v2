import unittest

from app.game import clock

TICKS = 30
T0 = 1_000_000


class ClockTests(unittest.TestCase):
    def test_running_clock_advances_one_tick_per_tick_ms(self):
        running = clock.start(T0)

        self.assertEqual([clock.current_tick(running, TICKS, T0 + ms) for ms in (0, 1999, 2000, 9000)], [0, 0, 1, 4])

    def test_clock_stops_at_the_last_tick(self):
        self.assertEqual(clock.current_tick(clock.start(T0), TICKS, T0 + 10**9), TICKS)

    def test_next_tick_at_is_the_next_boundary_and_none_when_ended(self):
        running = clock.start(T0)

        self.assertEqual(clock.next_tick_at(running, TICKS, T0 + 4500), T0 + 6000)
        self.assertIsNone(clock.next_tick_at(running, TICKS, T0 + 10**9))

    def test_pause_freezes_the_tick_and_resume_continues_from_it(self):
        paused = clock.pause(clock.start(T0), TICKS, T0 + 5000)

        frozen = clock.current_tick(paused, TICKS, T0 + 60000)
        resumed = clock.resume(paused, TICKS, T0 + 60000)

        self.assertEqual(frozen, 2)
        self.assertIsNone(clock.next_tick_at(paused, TICKS, T0 + 60000))
        self.assertEqual(clock.current_tick(resumed, TICKS, T0 + 62000), 3)

    def test_speed_change_keeps_the_tick_and_shortens_tick_ms(self):
        fast = clock.set_speed(clock.start(T0), TICKS, 4, T0 + 4000)

        self.assertEqual((fast['speed'], fast['tick_ms']), (4, 500))
        self.assertEqual(clock.current_tick(fast, TICKS, T0 + 4000), 2)
        self.assertEqual(clock.current_tick(fast, TICKS, T0 + 5000), 4)

    def test_unknown_speed_is_rejected(self):
        with self.assertRaises(ValueError):
            clock.set_speed(clock.start(T0), TICKS, 3, T0)

    def test_step_advances_exactly_one_tick_and_stays_paused(self):
        paused = clock.pause(clock.start(T0), TICKS, T0 + 4000)

        stepped = clock.step(paused, TICKS, T0 + 9000)

        self.assertTrue(stepped['paused'])
        self.assertEqual(clock.current_tick(stepped, TICKS, T0 + 50000), 3)

    def test_step_requires_a_paused_clock(self):
        with self.assertRaises(ValueError):
            clock.step(clock.start(T0), TICKS, T0)

    def test_step_does_not_pass_the_last_tick(self):
        ended = clock.pause(clock.start(T0), TICKS, T0 + 10**9)

        self.assertEqual(clock.current_tick(clock.step(ended, TICKS, T0 + 10**9), TICKS, T0 + 10**9), TICKS)

    def test_briefing_clock_is_paused_at_tick_zero(self):
        self.assertEqual(clock.current_tick(clock.briefing(T0), TICKS, T0 + 10**6), 0)

    def test_multiplayer_clock_uses_three_second_days(self):
        shared = clock.start(T0, clock.MULTIPLAYER_TICK_MS)

        self.assertEqual(clock.current_tick(shared, TICKS, T0 + 8999), 2)


if __name__ == '__main__':
    unittest.main()
