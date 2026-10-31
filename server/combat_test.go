package main

import "testing"

func combatEngine() *Engine {
	e := newEngine(42, 0, []int{0, 1}, nil)
	e.plans = [][]Event{{}, {}}
	return e
}
func TestCastCooldownAndLaneIsolation(t *testing.T) {
	e := combatEngine()
	e.Items = []Object{
		{Event: Event{Kind: "enemy", Obstacle: "ground"}, X: 250, Player: 1},
		{Event: Event{Kind: "enemy", Obstacle: "ground"}, X: 240, Player: 0},
		{Event: Event{Kind: "enemy", Obstacle: "ground"}, X: 290, Player: 0},
	}
	e.input(Action{Player: 0, Kind: "cast"})
	e.input(Action{Player: 0, Kind: "cast"})
	if len(e.Projectiles) != 1 {
		t.Fatal("repeated cast bypassed cooldown")
	}
	for i := 0; i < 6; i++ {
		e.step()
	}
	if e.Players[0].Score != 25 || !e.Items[1].Passed || e.Items[0].Passed || e.Items[2].Passed {
		t.Fatalf("wrong hit: %+v", e.Items)
	}
	for e.Tick < 24 {
		e.step()
	}
	e.input(Action{Player: 0, Kind: "cast"})
	if len(e.Projectiles) != 0 {
		t.Fatal("early cast")
	}
	e.step()
	e.input(Action{Player: 0, Kind: "cast"})
	if len(e.Projectiles) != 1 {
		t.Fatal("cooldown boundary rejected")
	}
}
func TestEnemyJumpDoesNotAwardAndContactHurts(t *testing.T) {
	e := combatEngine()
	e.Players[0].Y = -100
	e.Items = []Object{{Event: Event{Kind: "enemy", Obstacle: "ground"}, X: 125, Player: 0}}
	e.step()
	if e.Players[0].Score != 0 || e.Players[0].Lives != 3 {
		t.Fatal("jumped enemy gave points or damage")
	}
	e.Players[0].Y = 0
	e.Players[0].Velocity = 0
	e.Items = []Object{{Event: Event{Kind: "enemy", Obstacle: "ground"}, X: 165, Player: 0}}
	e.step()
	if e.Players[0].Lives != 2 {
		t.Fatal("enemy contact must hurt")
	}
}
func TestSpellMissExpiresAndNewRoundResets(t *testing.T) {
	e := combatEngine()
	e.input(Action{Player: 0, Kind: "cast"})
	for i := 0; i < 47; i++ {
		e.step()
	}
	if len(e.Projectiles) != 0 || e.Players[0].Score != 0 {
		t.Fatal("miss must expire without points")
	}
	next := newEngine(42, 1, []int{0}, nil)
	if next.Players[0].ReadyAt != 0 || len(next.Projectiles) != 0 {
		t.Fatal("new round retained combat state")
	}
}

func TestSlideContact(t *testing.T) {
	for _, kind := range []string{"enemy", "obstacle"} {
		t.Run(kind, func(t *testing.T) {
			e := combatEngine()
			e.input(Action{Player: 0, Kind: "duck", Pressed: true})
			e.Items = []Object{{Event: Event{Kind: kind, Obstacle: "ground"}, X: 180, Player: 0}}
			e.step()
			if kind == "enemy" {
				if e.Players[0].Lives != 3 || e.Players[0].Score != 25 || !e.Items[0].Passed || e.Items[0].DefeatedAt == 0 {
					t.Fatalf("slide failed: %+v %+v", e.Players[0], e.Items[0])
				}
				e.step()
				if e.Players[0].Score != 25 {
					t.Fatal("duplicate reward")
				}
			} else if e.Players[0].Lives != 2 || e.Players[0].Score != 0 {
				t.Fatal("slide must not break obstacles")
			}
		})
	}
}

func TestStellaBurstWaitsThenHitsNearestVisibleEnemy(t *testing.T) {
	e := newEngine(42, 0, []int{1}, nil)
	e.plans[0] = nil
	e.Items = []Object{{Event: Event{Kind: "enemy"}, X: 500, Player: 0}, {Event: Event{Kind: "enemy"}, X: 900, Player: 0}}
	e.Projectiles = []Projectile{{Player: 0, BurstAt: 360}}
	for n := 0; n < 17; n++ {
		e.step()
	}
	if e.Items[0].Passed {
		t.Fatal("burst hit before cast completed")
	}
	e.step()
	if !e.Items[0].Passed || e.Items[1].Passed || e.Players[0].Score != 25 {
		t.Fatal("burst must defeat only nearest visible enemy")
	}
}
