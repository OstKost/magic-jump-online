package main

import (
	"math"
	"testing"
)

func TestUpperPlatformsSupportSingleJumpAtEverySpeed(t *testing.T) {
	for world := 0; world < 5; world++ {
		for _, difficulty := range []string{"easy", "medium", "hard"} {
			e := newEngineWithDifficulty(42, 0, []int{0}, nil, difficulty)
			e.World = world
			e.plans = [][]Event{nil}
			e.Items = []Object{{Event: Event{Kind: "platform", Width: 480, Height: 90}, X: 490}, {Event: Event{Kind: "gap", Width: 260}, X: 580}}
			e.input(Action{Player: 0, Kind: "jump"})
			landed := false
			for tick := 0; tick < 180; tick++ {
				e.step()
				p := e.Players[0]
				landed = landed || (p.Grounded && p.Y == -90)
				if p.FallUntil > 0 {
					t.Fatalf("fell in world %d difficulty %s", world, difficulty)
				}
			}
			if !landed {
				t.Fatalf("missed platform in world %d difficulty %s", world, difficulty)
			}
		}
	}
}
func TestFallingLosesOneLifeAndRecovers(t *testing.T) {
	e := newEngine(42, 0, []int{0}, nil)
	e.plans = [][]Event{nil}
	e.Items = []Object{{Event: Event{Kind: "gap", Width: 260}, X: 160}}
	e.Players[0].Y = 209
	e.Players[0].Velocity = 300
	e.step()
	p := e.Players[0]
	if p.Lives != 2 || p.Y != 0 || p.FallUntil != 620 {
		t.Fatalf("unexpected recovery %+v", p)
	}
	for tick := 0; tick < 30; tick++ {
		e.step()
	}
	if e.Players[0].Lives != 2 {
		t.Fatal("recovery damaged the player twice")
	}
}
func TestUpperBonusAndProjectileHeight(t *testing.T) {
	e := newEngine(42, 0, []int{0}, nil)
	e.plans = [][]Event{nil}
	e.Players[0].Y = -90
	e.Players[0].Grounded = true
	e.Items = []Object{{Event: Event{Kind: "platform", Width: 480, Height: 90}, X: 160}, {Event: Event{Kind: "bonus", Height: 125}, X: 170}, {Event: Event{Kind: "enemy", Obstacle: "ground"}, X: 180}}
	e.input(Action{Player: 0, Kind: "cast"})
	e.step()
	e.step()
	if e.Players[0].Score != 25 {
		t.Fatal("bonus not awarded once")
	}
	if e.Items[2].DefeatedAt != 0 {
		t.Fatal("elevated projectile hit floor enemy")
	}
	if math.Abs(e.Projectiles[0].Y+120) > .01 {
		t.Fatal("projectile did not retain cast height")
	}
}
