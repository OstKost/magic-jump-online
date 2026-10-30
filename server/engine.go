package main

import (
	"math"
	"sort"
)

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
	ReadyAt    int     `json:"readyAt"`
	Lives      int     `json:"lives"`
	Score      int     `json:"score"`
	RoundScore int     `json:"roundScore"`
	Y          float64 `json:"y"`
	Velocity   float64 `json:"velocity"`
	Duck       bool    `json:"duck"`
	Held       bool    `json:"-"`
	Immune     int     `json:"-"`
	Hero       int     `json:"hero"`
	Connected  bool    `json:"connected"`
	Eligible   bool    `json:"eligible"`
	Jumps      int     `json:"jumps"`
}
type Object struct {
	DefeatedAt int `json:"defeatedAt"`
	Event
	X      float64 `json:"x"`
	Player int     `json:"player"`
	Passed bool    `json:"passed"`
}
type Projectile struct {
	X        float64 `json:"x"`
	Distance float64 `json:"distance"`
	Player   int     `json:"player"`
}
type Engine struct {
 World int `json:"world"`
	Projectiles []Projectile `json:"projectiles"`
	Tick        int          `json:"tick"`
	Level       int          `json:"level"`
	Difficulty  string       `json:"difficulty,omitempty"`
	Players     []Body       `json:"players"`
	Items       []Object     `json:"items"`
	plans       [][]Event
	next        []int
}

func scheduleWithDifficulty(seed uint32, difficulty string) []Event {
	random := func() float64 { seed = seed*1664525 + 1013904223; return float64(seed) / 4294967296 }
	var out []Event
	minInterval := 1700.
	randInterval := 700.
	maxAt := 55000.

	if difficulty == "easy" {
		minInterval = 1700
		randInterval = 700
		maxAt = 16000
	} else if difficulty == "medium" {
		minInterval = 1450
		randInterval = 600
		maxAt = 36000
	} else if difficulty == "hard" {
		minInterval = 1200
		randInterval = 500
		maxAt = 46000
	}

	for at := 2200.; at < maxAt; at += minInterval + random()*randInterval {
		v := int(random() * 5)
		if v == 4 {
			out = append(out, Event{at, "bonus", 0, "none"})
		} else {
			obstacle := "ground"
			if v == 3 {
				obstacle = "overhead"
			}
			out = append(out, Event{at, "obstacle", v % 3, obstacle})
			if random() > .25 {
				out = append(out, Event{at, "bonus", 0, obstacle})
			}
		}
	}
	enemyTimes := map[float64]int{}
	groundIndex := 0
	for _, ev := range out {
		if ev.Kind == "obstacle" && ev.Obstacle == "ground" {
			if groundIndex%2 == 0 {
				enemyTimes[ev.At] = (ev.Variant + groundIndex) % 2
			}
			groundIndex++
		}
	}
	converted := []Event{}
	for _, ev := range out {
		if variant, ok := enemyTimes[ev.At]; ok {
			if ev.Kind == "bonus" {
				continue
			}
			ev.Kind = "enemy"
			ev.Variant = variant
		}
		converted = append(converted, ev)
	}
	return converted
}

func schedule(seed uint32) []Event {
	return scheduleWithDifficulty(seed, "")
}

func routeWithDifficulty(seed uint32, player int, difficulty string) []Event {
	source := scheduleWithDifficulty(seed, difficulty)
	if len(source) == 0 {
		return nil
	}
	var times []float64
	seen := make(map[float64]bool)
	for _, e := range source {
		if !seen[e.At] {
			seen[e.At] = true
			times = append(times, e.At)
		}
	}
	sort.Float64s(times)
	if len(times) == 0 {
		return nil
	}
	blocks := make([][]Event, len(times))
	for i, t := range times {
		for _, e := range source {
			if e.At == t {
				blocks[i] = append(blocks[i], e)
			}
		}
	}
	shift := player % len(times)
	var out []Event
	for i, targetAt := range times {
		block := blocks[(i+shift)%len(times)]
		for _, e := range block {
			e.At = targetAt
			out = append(out, e)
		}
	}
	return out
}

func route(seed uint32, player int) []Event {
	return routeWithDifficulty(seed, player, "")
}

func newEngineWithDifficulty(seed uint32, level int, heroes []int, totals []int, difficulty string) *Engine {
	lives := 3
	if difficulty == "easy" {
		lives = 4
	}
	e := &Engine{
		Level:      level,
 World: worldOrder(seed)[level],
		Difficulty: difficulty,
		Players:    make([]Body, len(heroes)),
		plans:      make([][]Event, len(heroes)),
		next:       make([]int, len(heroes)),
		Items:      []Object{},
	}
	for i, h := range heroes {
		e.Players[i] = Body{Lives: lives, Hero: h, Connected: true, Eligible: true}
		if i < len(totals) {
			e.Players[i].Score = totals[i]
		}
		e.plans[i] = routeWithDifficulty(seed+uint32(level), i, difficulty)
	}
	return e
}

func newEngine(seed uint32, level int, heroes []int, totals []int) *Engine {
	return newEngineWithDifficulty(seed, level, heroes, totals, "")
}

func (e *Engine) input(a Action) {
	if a.Player < 0 || a.Player >= len(e.Players) {
		return
	}
	p := &e.Players[a.Player]
	switch a.Kind {
	case "cast":
		if e.Tick*stepMS >= p.ReadyAt {
			p.ReadyAt = e.Tick*stepMS + 2000
			e.Projectiles = append(e.Projectiles, Projectile{X: 160, Player: a.Player})
		}
	case "jump":
		if !p.Held {
			if p.Y >= -.1 {
				p.Velocity = -650
				p.Jumps = 1
			} else if p.Jumps < 2 {
				p.Velocity = -650
				p.Jumps = 2
			}
		}
	case "duck":
		p.Held = a.Pressed
	}
}
func collision(p Body, obstacle string) bool {
	if obstacle == "none" {
		return false
	}
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
	speedMult := 1.0
	if e.Difficulty == "easy" {
		speedMult = 0.9
	} else if e.Difficulty == "hard" {
		speedMult = 1.05
	}
	speed := []float64{270, 310, 350, 350, 350}[e.World] * speedMult
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
			p.Jumps = 0
		}
		p.Duck = p.Y == 0 && p.Held
	}
	keptShots := []Projectile{}
	for _, shot := range e.Projectiles {
		from := shot.X
		travel := math.Min(14, 650-shot.Distance)
		shot.X += travel
		shot.Distance += travel
		target := -1
		for i := range e.Items {
			o := &e.Items[i]
			if o.Kind == "enemy" && !o.Passed && o.Player == shot.Player && o.X+28 >= from && o.X-28 <= shot.X+speed*.02 && (target < 0 || o.X < e.Items[target].X) {
				target = i
			}
		}
		if target >= 0 {
			e.Items[target].Passed = true
			e.Items[target].DefeatedAt = elapsed
			p := &e.Players[shot.Player]
			points := 25
			if p.Lives == 0 {
				points = 20
			}
			p.Score += points
			p.RoundScore += points
		} else if shot.Distance < 650 {
			keptShots = append(keptShots, shot)
		}
	}
	e.Projectiles = keptShots
	for i := range e.Items {
		o := &e.Items[i]
		o.X -= speed * .02
		p := &e.Players[o.Player]
		award := func(points int) {
			if p.Lives == 0 {
				points = points * 8 / 10
			}
			p.Score += points
			p.RoundScore += points
		}
		threshold := 28.
		if o.Kind == "bonus" {
			threshold = 30
		}
		if !o.Passed && math.Abs(o.X-160) < threshold {
			if (o.Kind == "obstacle" || o.Kind == "enemy") && collision(*p, o.Obstacle) {
				o.Passed = true
				if p.Lives > 0 && elapsed >= p.Immune {
					p.Lives--
					p.Immune = elapsed + 1000
				}
			}
			if o.Kind == "bonus" && ((o.Obstacle == "overhead" && p.Duck && p.Y == 0) || (o.Obstacle == "none" && p.Y < -130 && p.Y > -230) || (o.Obstacle == "ground" && p.Y < -35 && p.Y > -146)) {
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

func (e *Engine) allDead() bool {
	for _, p := range e.Players {
		if p.Eligible && p.Lives > 0 {
			return false
		}
	}
	return true
}

func worldOrder(seed uint32) []int {
 order := []int{0,1,2,3,4}
 for i:=len(order)-1; i>1; i-- {
  seed = seed*1664525+1013904223
  j:=1+int(float64(seed)/4294967296*float64(i))
  order[i],order[j]=order[j],order[i]
 }
 return order
}
