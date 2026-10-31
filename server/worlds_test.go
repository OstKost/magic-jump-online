package main

import "testing"

func TestWorldOrder(t *testing.T) {
	for seed := uint32(0); seed < 100; seed++ {
		order := worldOrder(seed)
		seen := map[int]bool{}
		if order[0] != 0 {
			t.Fatal("tutorial must be first")
		}
		for _, world := range order {
			if seen[world] || world < 0 || world >= 5 {
				t.Fatal(order)
			}
			seen[world] = true
		}
		for stage := 0; stage < journeyStages; stage++ {
			e := newEngine(seed, stage, []int{0}, nil)
			if e.World != order[stage] {
				t.Fatal("world mismatch")
			}
			e.step()
		}
	}
}

func TestWorldOrderSeedFixture(t *testing.T) {
	want := []int{0, 3, 4}
	for i, world := range worldOrder(42) {
		if world != want[i] {
			t.Fatal("seed order mismatch")
		}
	}
}
