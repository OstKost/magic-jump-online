package main

import (
	"math"
	"sort"
)

const stepMS = 20

type Event struct {
	Offset   float64 `json:"offset,omitempty"`
	Width    float64 `json:"width,omitempty"`
	Height   float64 `json:"height,omitempty"`
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
	ReadyDashAt int     `json:"readyDashAt"`
	DashUntil   int     `json:"dashUntil"`
	ReadyAt     int     `json:"readyAt"`
	Lives       int     `json:"lives"`
	Score       int     `json:"score"`
	RoundScore  int     `json:"roundScore"`
	Y           float64 `json:"y"`
	Velocity    float64 `json:"velocity"`
	Duck        bool    `json:"duck"`
	Held        bool    `json:"-"`
	Immune      int     `json:"-"`
	Hero        int     `json:"hero"`
	Connected   bool    `json:"connected"`
	Eligible    bool    `json:"eligible"`
	Grounded    bool    `json:"grounded"`
	FallUntil   int     `json:"fallUntil"`
	Jumps       int     `json:"jumps"`
}
type Object struct {
	DefeatedAt int `json:"defeatedAt"`
	Event
	X      float64 `json:"x"`
	Player int     `json:"player"`
	Passed bool    `json:"passed"`
}
type Projectile struct {
	BurstAt  int     `json:"burstAt,omitempty"`
	X        float64 `json:"x"`
	Distance float64 `json:"distance"`
	Player   int     `json:"player"`
	Y        float64 `json:"y"`
}
type Engine struct {
	World       int          `json:"world"`
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
	maxAt := 54000.

	if difficulty == "easy" {
		minInterval = 1700
		randInterval = 700
		maxAt = 14000
	} else if difficulty == "medium" {
		minInterval = 1450
		randInterval = 600
		maxAt = 34000
	} else if difficulty == "hard" {
		minInterval = 1200
		randInterval = 500
		maxAt = 44000
	}

	for at := 2200.; at < maxAt; at += minInterval + random()*randInterval {
		v := int(random() * 5)
		if v == 4 {
			out = append(out, Event{At: at, Kind: "bonus", Variant: 0, Obstacle: "none"})
		} else {
			obstacle := "ground"
			if v == 3 {
				obstacle = "overhead"
			}
			out = append(out, Event{At: at, Kind: "obstacle", Variant: v % 3, Obstacle: obstacle})
			if random() > .25 {
				out = append(out, Event{At: at, Kind: "bonus", Variant: 0, Obstacle: obstacle})
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
		section := (i + shift) % len(blocks)
		if section%4 == 2 {
			danger := []string{"puddle", "gap", "fire"}[(section/4+int(seed%3))%3]
			out = append(out, Event{At: targetAt, Kind: "platform", Offset: -90, Width: 480, Height: 90}, Event{At: targetAt, Kind: danger, Width: 260})
			for n := 0; n < 7; n++ {
				out = append(out, Event{At: targetAt, Kind: "bonus", Offset: float64(-195 + n*65), Height: 125})
			}
		} else if section%4 == 0 {
			for _, ev := range block {
				if ev.Kind != "bonus" {
					ev.At = targetAt
					out = append(out, ev)
				}
			}
			for n := 0; n < 5; n++ {
				out = append(out, Event{At: targetAt, Kind: "bonus", Offset: float64(-120 + n*60), Height: math.Round(115 + math.Sin(float64(n)/4*math.Pi)*65)})
			}
		} else {
			for _, ev := range block {
				ev.At = targetAt
				out = append(out, ev)
			}
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
		World:      worldOrder(seed)[level],
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
	case "dash":
		if e.Tick*stepMS >= p.ReadyDashAt {
			p.ReadyDashAt = e.Tick*stepMS + 2000
			p.DashUntil = e.Tick*stepMS + 240
		}
	case "cast":
		if e.Tick*stepMS >= p.ReadyAt {
			p.ReadyAt = e.Tick*stepMS + 500
			shot := Projectile{X: 160, Player: a.Player, Y: p.Y - 30}
			rng := uint32(p.ReadyAt+a.Player*7919)*1664525 + 1013904223
			if p.Hero == 1 && float64(rng)/4294967296 < .1 {
				shot.BurstAt = e.Tick*stepMS + 360
			}
			e.Projectiles = append(e.Projectiles, shot)
		}
	case "jump":
		if !p.Held && p.Y <= 0 {
			if p.Grounded || p.Y >= -.1 {
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
			e.Items = append(e.Items, Object{Event: plan[e.next[i]], X: 1150 + plan[e.next[i]].Offset, Player: i})
			e.next[i]++
		}
	}
	for i := range e.Players {
		p := &e.Players[i]
		if p.FallUntil > elapsed {
			p.Y = 0
			p.Velocity = 0
			p.Grounded = true
			p.Duck = p.Held
			continue
		}
		previous := p.Y
		if elapsed < p.DashUntil {
			p.Velocity = math.Min(p.Velocity, 10)
		} else {
			p.Velocity += 38
		}
		next := previous + p.Velocity*.02
		surface := 0.
		for _, o := range e.Items {
			if elapsed >= p.DashUntil && o.Player == i && o.Kind == "gap" && math.Abs(o.X-speed*.02-160) < o.Width/2 {
				surface = math.Inf(1)
			}
		}
		for _, o := range e.Items {
			if o.Player == i && o.Kind == "platform" && math.Abs(o.X-speed*.02-160) < o.Width/2 && previous <= -o.Height+.1 && next >= -o.Height && p.Velocity >= 0 {
				surface = math.Min(surface, -o.Height)
			}
		}
		p.Grounded = next >= surface && p.Velocity >= 0
		p.Y = next
		if p.Grounded {
			p.Y = surface
			p.Velocity = 0
			p.Jumps = 0
		}
		if p.Y > 210 {
			if p.Lives > 0 && elapsed >= p.Immune && elapsed >= p.DashUntil {
				p.Lives--
				p.Immune = elapsed + 1000
			}
			p.Y = 0
			p.Velocity = 0
			p.Jumps = 0
			p.Grounded = true
			p.FallUntil = elapsed + 600
		}
		if p.FallUntil > elapsed {
			p.Y = 0
			p.Velocity = 0
			p.Grounded = true
		}
		p.Duck = p.Grounded && p.Held
	}
	keptShots := []Projectile{}
	for _, shot := range e.Projectiles {
		if shot.BurstAt > elapsed {
			keptShots = append(keptShots, shot)
			continue
		}
		if shot.BurstAt > 0 {
			target := -1
			for i, o := range e.Items {
				if o.Kind == "enemy" && !o.Passed && o.Player == shot.Player && o.X >= 0 && o.X <= 1150 && (target < 0 || math.Abs(o.X-160) < math.Abs(e.Items[target].X-160)) {
					target = i
				}
			}
			if target >= 0 {
				e.Items[target].Passed = true
				e.Items[target].DefeatedAt = elapsed
				points := 25
				if e.Players[shot.Player].Lives == 0 {
					points = 20
				}
				e.Players[shot.Player].Score += points
				e.Players[shot.Player].RoundScore += points
			}
			continue
		}
		from := shot.X
		travel := math.Min(14, 650-shot.Distance)
		shot.X += travel
		shot.Distance += travel
		target := -1
		for i := range e.Items {
			o := &e.Items[i]
			if o.Kind == "enemy" && math.Abs(shot.Y+35) < 65 && !o.Passed && o.Player == shot.Player && o.X+28 >= from && o.X-28 <= shot.X+speed*.02 && (target < 0 || o.X < e.Items[target].X) {
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
		dashX := 160.
		if elapsed < p.DashUntil {
			dashX += 160 * math.Sin(math.Pow(float64(elapsed-(p.DashUntil-240))/240, .75)*math.Pi)
		}
		if !o.Passed && (math.Abs(o.X-160) < threshold || math.Abs(o.X-dashX) < threshold+2) {
			if (o.Kind == "obstacle" || o.Kind == "enemy") && collision(*p, o.Obstacle) {
				o.Passed = true
				if o.Kind == "enemy" && p.Duck {
					o.DefeatedAt = elapsed
					award(25)
				} else if elapsed < p.DashUntil {
					award(15)
				} else if p.Lives > 0 && elapsed >= p.Immune && elapsed >= p.DashUntil {
					p.Lives--
					p.Immune = elapsed + 1000
				}
			}
			if o.Kind == "bonus" && ((o.Height > 0 && math.Abs(p.Y+o.Height-35) < 42) || (o.Height == 0 && ((o.Obstacle == "overhead" && p.Duck && p.Y == 0) || (o.Obstacle == "none" && p.Y < -130 && p.Y > -230) || (o.Obstacle == "ground" && p.Y < -35 && p.Y > -146)))) {
				award(25)
				o.Passed = true
			}
		}
		if (o.Kind == "puddle" || o.Kind == "fire") && (math.Abs(o.X-160) < o.Width/2 || math.Abs(o.X-dashX) < o.Width/2) && p.Y > -25 && p.Lives > 0 && elapsed >= p.Immune && elapsed >= p.DashUntil {
			p.Lives--
			p.Immune = elapsed + 1000
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
		if o.X >= -math.Max(50, o.Width) {
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

const journeyStages = 3

func worldOrder(seed uint32) []int {
	order := []int{0, 1, 2, 3, 4}
	for i := len(order) - 1; i > 1; i-- {
		seed = seed*1664525 + 1013904223
		j := 1 + int(float64(seed)/4294967296*float64(i))
		order[i], order[j] = order[j], order[i]
	}
	return order[:journeyStages]
}
