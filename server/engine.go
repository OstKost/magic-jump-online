package main

import "math"

const stepMS = 20

type Event struct {
	At       float64 `json:"at"`
	Kind     string  `json:"kind"`
	Variant  int     `json:"variant"`
	Obstacle string  `json:"obstacle"`
}
type Action struct {
	Tick    int    `json:"tick"`
	Player  int    `json:"player"`
	Kind    string `json:"kind"`
	Pressed bool   `json:"pressed"`
}
type Body struct {
	Lives     int     `json:"lives"`
	Score     int     `json:"score"`
	Y         float64 `json:"y"`
	Velocity  float64 `json:"velocity"`
	Duck      bool    `json:"duck"`
	Held      bool    `json:"-"`
	Immune    int     `json:"-"`
	Hero      int     `json:"hero"`
	Connected bool    `json:"connected"`
	Eligible  bool    `json:"eligible"`
}
type Object struct {
	Event
	X      float64 `json:"x"`
	Player int     `json:"player"`
	Passed bool    `json:"passed"`
}
type Engine struct {
	Tick    int      `json:"tick"`
	Level   int      `json:"level"`
	Players []Body   `json:"players"`
	Items   []Object `json:"items"`
	plans   [][]Event
	next    []int
}

func schedule(seed uint32) []Event {
	random := func() float64 { seed = seed*1664525 + 1013904223; return float64(seed) / 4294967296 }
	var out []Event
	for at := 2200.; at < 55000; at += 1700 + random()*700 {
		v := int(random() * 4)
		obstacle := "ground"
		if v == 3 {
			obstacle = "overhead"
		}
		out = append(out, Event{at, "obstacle", v % 3, obstacle})
		if random() > .25 {
			out = append(out, Event{at, "bonus", 0, obstacle})
		}
	}
	return out
}
func route(seed uint32, player int) []Event {
	source := schedule(seed)
	var obstacles []Event
	for _, e := range source {
		if e.Kind == "obstacle" {
			obstacles = append(obstacles, e)
		}
	}
	var out []Event
	for i, slot := range obstacles {
		block := obstacles[(i+player)%len(obstacles)]
		at := block.At
		block.At = slot.At
		out = append(out, block)
		for _, e := range source {
			if e.Kind == "bonus" && e.At == at {
				e.At = slot.At
				out = append(out, e)
			}
		}
	}
	return out
}
func newEngine(seed uint32, level int, heroes []int, totals []int) *Engine {
	e := &Engine{Level: level, Players: make([]Body, len(heroes)), plans: make([][]Event, len(heroes)), next: make([]int, len(heroes)), Items: []Object{}}
	for i, h := range heroes {
		e.Players[i] = Body{Lives: 3, Hero: h, Connected: true, Eligible: true}
		if i < len(totals) {
			e.Players[i].Score = totals[i]
		}
		e.plans[i] = route(seed+uint32(level), i)
	}
	return e
}
func (e *Engine) input(a Action) {
	if a.Player < 0 || a.Player >= len(e.Players) {
		return
	}
	p := &e.Players[a.Player]
	switch a.Kind {
	case "jump":
		if p.Y >= -.1 && !p.Held {
			p.Velocity = -650
		}
	case "duck":
		p.Held = a.Pressed
	}
}
func collision(p Body, obstacle string) bool {
	feet := -p.Y
	head := feet + 102
	if p.Duck {
		head = feet + 66
	}
	bottom, top := 0., 43.
	if obstacle == "overhead" {
		bottom, top = 76, 112
	}
	return feet < top && head > bottom
}
func (e *Engine) step() {
	e.Tick++
	elapsed := e.Tick * stepMS
	speed := []float64{270, 310, 350}[e.Level]
	for i, plan := range e.plans {
		for e.next[i] < len(plan) && plan[e.next[i]].At <= float64(elapsed) {
			e.Items = append(e.Items, Object{Event: plan[e.next[i]], X: 1150, Player: i})
			e.next[i]++
		}
	}
	for i := range e.Players {
		p := &e.Players[i]
		p.Velocity += 1900 * .02
		p.Y = math.Min(0, p.Y+p.Velocity*.02)
		if p.Y == 0 {
			p.Velocity = 0
		}
		p.Duck = p.Y == 0 && p.Held
	}
	for i := range e.Items {
		o := &e.Items[i]
		o.X -= speed * .02
		p := &e.Players[o.Player]
		award := func(points int) {
			if p.Lives == 0 {
				points = points * 8 / 10
			}
			p.Score += points
		}
		threshold := 28.
		if o.Kind == "bonus" {
			threshold = 30
		}
		if !o.Passed && math.Abs(o.X-160) < threshold {
			if o.Kind == "obstacle" && collision(*p, o.Obstacle) {
				o.Passed = true
				if p.Lives > 0 && elapsed >= p.Immune {
					p.Lives--
					p.Immune = elapsed + 1000
				}
			}
			if o.Kind == "bonus" && ((o.Obstacle == "overhead" && p.Duck && p.Y == 0) || (o.Obstacle != "overhead" && p.Y < -35 && p.Y > -146)) {
				award(25)
				o.Passed = true
			}
		}
		if !o.Passed && o.X < 120 {
			if o.Kind == "obstacle" {
				award(10)
			}
			o.Passed = true
		}
	}
	kept := e.Items[:0]
	for _, o := range e.Items {
		if o.X >= -50 {
			kept = append(kept, o)
		}
	}
	e.Items = kept
}
