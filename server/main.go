package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/gorilla/websocket"
	"log"
	"math/big"
	_ "modernc.org/sqlite"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	_ "time/tzdata"
	"unicode"
)

type Member struct {
	ID        string `json:"id"`
	Hero      int    `json:"hero"`
	Ready     bool   `json:"ready"`
	Connected bool   `json:"connected"`
	token     string
	conn      *websocket.Conn
	gone      time.Time
	lastInput time.Time
}
type Room struct {
	Code     string    `json:"code"`
	Host     string    `json:"host"`
	Phase    string    `json:"phase"`
	Members  []*Member `json:"members"`
	Engine   *Engine   `json:"engine,omitempty"`
	ID       string    `json:"id"`
	Seed     uint32    `json:"seed"`
	created  time.Time
	finished time.Time
}
type Attempt struct {
	ID      string `json:"id"`
	Token   string `json:"token"`
	Seed    uint32 `json:"seed"`
	Count   int    `json:"count"`
	created time.Time
	done    bool
	players []Body
}
type Server struct {
	mu       sync.Mutex
	rooms    map[string]*Room
	attempts map[string]*Attempt
	db       *sql.DB
	origin   string
	limits   map[string][]time.Time
}

func token() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
func seed() uint32 { n, _ := rand.Int(rand.Reader, big.NewInt(1<<32)); return uint32(n.Uint64()) }
func week(t time.Time) string {
	loc, _ := time.LoadLocation("Europe/Moscow")
	t = t.In(loc)
	d := (int(t.Weekday()) + 6) % 7
	return t.AddDate(0, 0, -d).Format("2006-01-02")
}
func send(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(v)
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 2<<20)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		http.Error(w, "Некорректный запрос", 400)
		return false
	}
	return true
}
func (s *Server) allowed(w http.ResponseWriter, r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin != "" && origin != s.origin {
		u, err := url.Parse(origin)
		if err != nil || u.Host != r.Host {
			http.Error(w, "Недопустимый источник", 403)
			return false
		}
	}
	if r.Method == "GET" {
		return true
	}
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	if ip := net.ParseIP(r.Header.Get("X-Real-IP")); ip != nil {
		host = ip.String()
	}
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	var recent []time.Time
	for _, t := range s.limits[host] {
		if now.Sub(t) < time.Minute {
			recent = append(recent, t)
		}
	}
	if len(recent) >= 120 {
		http.Error(w, "Слишком много запросов", 429)
		return false
	}
	s.limits[host] = append(recent, now)
	return true
}
func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		if err := s.db.Ping(); err != nil {
			http.Error(w, "database unavailable", 503)
			return
		}
		send(w, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("POST /api/rooms", s.createRoom)
	mux.HandleFunc("POST /api/rooms/{code}/join", s.joinRoom)
	mux.HandleFunc("GET /api/rooms/{code}/ws", s.socket)
	mux.HandleFunc("POST /api/attempts", s.createAttempt)
	mux.HandleFunc("POST /api/attempts/{id}/finish", s.finishAttempt)
	mux.HandleFunc("POST /api/results", s.saveResult)
	mux.HandleFunc("GET /api/ranking", s.ranking)
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		root := env("STATIC_DIR", "../dist")
		name := filepath.Clean(r.URL.Path)
		if name == "/" {
			name = "/index.html"
		}
		path := filepath.Join(root, name)
		if _, err := os.Stat(path); err != nil {
			http.NotFound(w, r)
			return
		}
		if strings.HasSuffix(name, ".html") || name == "/sw.js" {
			w.Header().Set("Cache-Control", "no-cache")
		}
		http.ServeFile(w, r, path)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		if strings.HasPrefix(r.URL.Path, "/api/") && !s.allowed(w, r) {
			return
		}
		mux.ServeHTTP(w, r)
	})
}
func (s *Server) createRoom(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.rooms) >= 500 {
		http.Error(w, "Сервер занят", 503)
		return
	}
	code := ""
	for {
		n, _ := rand.Int(rand.Reader, big.NewInt(10000))
		code = fmt.Sprintf("%04d", n)
		if s.rooms[code] == nil {
			break
		}
	}
	m := &Member{ID: token(), token: token(), Hero: 0, gone: time.Now()}
	room := &Room{Code: code, Host: m.ID, Phase: "lobby", Members: []*Member{m}, ID: token(), Seed: seed(), created: time.Now()}
	s.rooms[code] = room
	send(w, map[string]any{"code": code, "token": m.token, "id": m.ID})
}
func (s *Server) joinRoom(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	defer s.mu.Unlock()
	room := s.rooms[r.PathValue("code")]
	if room == nil {
		http.Error(w, "Комната не найдена", 404)
		return
	}
	if room.Phase != "lobby" || len(room.Members) >= 4 {
		http.Error(w, "Комната заполнена или игра уже началась", 409)
		return
	}
	used := map[int]bool{}
	for _, m := range room.Members {
		used[m.Hero] = true
	}
	h := 0
	for used[h] {
		h++
	}
	m := &Member{ID: token(), token: token(), Hero: h, gone: time.Now()}
	room.Members = append(room.Members, m)
	s.broadcast(room)
	send(w, map[string]any{"code": room.Code, "token": m.token, "id": m.ID})
}
func (s *Server) broadcast(room *Room) {
	for _, m := range room.Members {
		if m.conn != nil {
			_ = m.conn.SetWriteDeadline(time.Now().Add(150 * time.Millisecond))
			if err := m.conn.WriteJSON(room); err != nil {
				_ = m.conn.Close()
				m.conn = nil
				m.Connected = false
				m.gone = time.Now()
			}
		}
	}
}
func (s *Server) socket(w http.ResponseWriter, r *http.Request) {
	// Authenticate in the first frame so credentials do not enter access-log URLs.
	up := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }, Subprotocols: []string{"jump-v1"}}
	c, err := up.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	defer c.Close()
	c.SetReadLimit(4096)
	_ = c.SetReadDeadline(time.Now().Add(5 * time.Second))
	var auth struct {
		Token string `json:"token"`
	}
	if c.ReadJSON(&auth) != nil {
		return
	}
	s.mu.Lock()
	room := s.rooms[r.PathValue("code")]
	var member *Member
	if room != nil {
		for _, m := range room.Members {
			if m.token == auth.Token && auth.Token != "" {
				member = m
			}
		}
	}
	if member != nil && room.Engine != nil {
		for i, m := range room.Members {
			if m == member && !room.Engine.Players[i].Eligible {
				member = nil
				break
			}
		}
	}
	if member == nil {
		_ = c.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(1008, "Сессия истекла"), time.Now().Add(time.Second))
		s.mu.Unlock()
		return
	}
	if member.conn != nil {
		_ = member.conn.Close()
	}
	member.conn = c
	member.Connected = true
	member.gone = time.Time{}
	s.broadcast(room)
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		if member.conn == c {
			member.conn = nil
			member.Connected = false
			member.Ready = false
			if member.gone.IsZero() {
				member.gone = time.Now()
			}
			if room.Engine != nil {
				for i, m := range room.Members {
					if m == member {
						room.Engine.Players[i].Held = false
					}
				}
			}
			s.broadcast(room)
		}
	}()
	c.SetPongHandler(func(string) error { return c.SetReadDeadline(time.Now().Add(45 * time.Second)) })
	windowStart := time.Now()
	messages := 0
	for {
		_ = c.SetReadDeadline(time.Now().Add(45 * time.Second))
		var msg struct {
			Type    string `json:"type"`
			Hero    int    `json:"hero"`
			Pressed bool   `json:"pressed"`
		}
		if c.ReadJSON(&msg) != nil {
			return
		}
		if time.Since(windowStart) > time.Second {
			windowStart = time.Now()
			messages = 0
		}
		messages++
		if messages > 150 {
			return
		}
		s.mu.Lock()
		if member.conn != c {
			s.mu.Unlock()
			return
		}
		idx := -1
		for i, m := range room.Members {
			if m == member {
				idx = i
			}
		}
		if idx < 0 {
			s.mu.Unlock()
			return
		}
		switch msg.Type {
		case "hero":
			if room.Phase == "lobby" && msg.Hero >= 0 && msg.Hero < 4 {
				free := true
				for _, m := range room.Members {
					if m != member && m.Hero == msg.Hero {
						free = false
					}
				}
				if free {
					member.Hero = msg.Hero
					member.Ready = false
				}
			}
		case "ready":
			if room.Phase == "lobby" || room.Phase == "between" {
				member.Ready = true
			}
		case "start":
			if room.Host == member.ID && (room.Phase == "lobby" || room.Phase == "between") && len(room.Members) >= 2 {
				ready := true
				var heroes, totals []int
				level := 0
				if room.Engine != nil {
					level = room.Engine.Level + 1
				}
				for i, m := range room.Members {
					if room.Engine == nil || room.Engine.Players[i].Eligible {
						ready = ready && m.Ready && m.Connected
					}
					heroes = append(heroes, m.Hero)
					if room.Engine != nil {
						totals = append(totals, room.Engine.Players[i].Score)
					}
				}
				if ready && level < 3 {
					previous := room.Engine
					room.Engine = newEngine(room.Seed, level, heroes, totals)
					if previous != nil {
						for i := range room.Engine.Players {
							room.Engine.Players[i].Eligible = previous.Players[i].Eligible
						}
					}
					room.Phase = "playing"
					for _, m := range room.Members {
						m.Ready = false
					}
				}
			}
		case "jump", "duck":
			if room.Phase == "playing" && (msg.Type == "duck" && !msg.Pressed || time.Since(member.lastInput) >= 10*time.Millisecond) {
				room.Engine.input(Action{Player: idx, Kind: msg.Type, Pressed: msg.Pressed})
				member.lastInput = time.Now()
			}
		case "leave":
			_ = c.Close()
			member.gone = time.Now().Add(-31 * time.Second)
		case "ping":
			s.mu.Unlock()
			continue
		}
		s.broadcast(room)
		s.mu.Unlock()
	}
}
func (s *Server) loop(stop <-chan struct{}) {
	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-stop:
			return
		case now := <-ticker.C:
			s.mu.Lock()
			for code, room := range s.rooms {
				if now.Sub(room.created) > 2*time.Hour || (!room.finished.IsZero() && now.Sub(room.finished) > 10*time.Minute) {
					for _, m := range room.Members {
						if m.conn != nil {
							_ = m.conn.Close()
						}
					}
					delete(s.rooms, code)
					continue
				}
				for i := len(room.Members) - 1; i >= 0; i-- {
					m := room.Members[i]
					if !m.Connected && !m.gone.IsZero() && now.Sub(m.gone) > 30*time.Second {
						if room.Phase == "lobby" {
							room.Members = append(room.Members[:i], room.Members[i+1:]...)
							if room.Host == m.ID && len(room.Members) > 0 {
								room.Host = room.Members[0].ID
							}
						} else if room.Engine != nil {
							room.Engine.Players[i].Eligible = false
							if room.Host == m.ID {
								for j, other := range room.Members {
									if other.Connected && room.Engine.Players[j].Eligible {
										room.Host = other.ID
										break
									}
								}
							}
						}
					}
				}
				if len(room.Members) == 0 {
					delete(s.rooms, code)
					continue
				}
				if room.Phase == "playing" {
					for i, m := range room.Members {
						room.Engine.Players[i].Connected = m.Connected
					}
					room.Engine.step()
					if room.Engine.Tick >= 3000 {
						room.Phase = "between"
						if room.Engine.Level == 2 {
							room.Phase = "finished"
							room.finished = now
							s.record(room.ID, room.Engine.Players, now)
						}
						for _, m := range room.Members {
							m.Ready = false
						}
					}
				}
				if room.Engine == nil || room.Engine.Tick%3 == 0 {
					s.broadcast(room)
				}
			}
			for id, a := range s.attempts {
				if now.Sub(a.created) > 2*time.Hour {
					delete(s.attempts, id)
				}
			}
			s.mu.Unlock()
		}
	}
}
func (s *Server) createAttempt(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Count int `json:"count"`
	}
	if !decode(w, r, &req) {
		return
	}
	if req.Count < 1 || req.Count > 2 {
		http.Error(w, "Недопустимое число игроков", 400)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(s.attempts) >= 10000 {
		http.Error(w, "Сервер занят", 503)
		return
	}
	a := &Attempt{ID: token(), Token: token(), Seed: seed(), Count: req.Count, created: time.Now()}
	s.attempts[a.ID] = a
	send(w, a)
}
func (s *Server) finishAttempt(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Token  string     `json:"token"`
		Heroes []int      `json:"heroes"`
		Logs   [][]Action `json:"logs"`
	}
	if !decode(w, r, &req) {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	a := s.attempts[r.PathValue("id")]
	if a == nil || a.Token != req.Token {
		http.Error(w, "Попытка не найдена", 404)
		return
	}
	if a.done {
		send(w, map[string]any{"id": a.ID, "players": a.players})
		return
	}
	if time.Since(a.created) < 180*time.Second || time.Since(a.created) > 2*time.Hour || len(req.Heroes) != a.Count || len(req.Logs) != 3 {
		http.Error(w, "Незавершённое путешествие", 400)
		return
	}
	used := map[int]bool{}
	for _, h := range req.Heroes {
		if h < 0 || h > 3 || used[h] {
			http.Error(w, "Недопустимые герои", 400)
			return
		}
		used[h] = true
	}
	var totals []int
	var engine *Engine
	for level, logs := range req.Logs {
		if len(logs) > 20000 {
			http.Error(w, "Слишком много действий", 400)
			return
		}
		last := -1
		for _, action := range logs {
			if action.Tick < last || action.Tick < 0 || action.Tick >= 3000 || action.Player < 0 || action.Player >= a.Count || (action.Kind != "jump" && action.Kind != "duck") {
				http.Error(w, "Некорректный журнал", 400)
				return
			}
			last = action.Tick
		}
		engine = newEngine(a.Seed, level, req.Heroes, totals)
		next := 0
		for engine.Tick < 3000 {
			for next < len(logs) && logs[next].Tick == engine.Tick {
				engine.input(logs[next])
				next++
			}
			engine.step()
		}
		totals = nil
		for _, p := range engine.Players {
			totals = append(totals, p.Score)
		}
	}
	if err := s.record(a.ID, engine.Players, time.Now()); err != nil {
		http.Error(w, "Не удалось сохранить результат", 500)
		return
	}
	a.done = true
	a.players = engine.Players
	send(w, map[string]any{"id": a.ID, "players": engine.Players})
}
func (s *Server) record(id string, players []Body, now time.Time) error {
	max := -1
	for _, p := range players {
		if p.Eligible && p.Score > max {
			max = p.Score
		}
	}
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for i, p := range players {
		if p.Eligible && p.Score == max {
			if _, err = tx.Exec("INSERT OR IGNORE INTO results(match_id,player,score,week,finished) VALUES(?,?,?,?,?)", id, i, p.Score, week(now), now.Unix()); err != nil {
				return err
			}
		}
	}
	return tx.Commit()
}
func (s *Server) saveResult(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ID     string `json:"id"`
		Token  string `json:"token"`
		Player int    `json:"player"`
		Name   string `json:"name"`
	}
	if !decode(w, r, &req) {
		return
	}
	name := strings.TrimSpace(req.Name)
	if len([]rune(name)) < 1 || len([]rune(name)) > 20 || strings.IndexFunc(name, unicode.IsControl) >= 0 {
		http.Error(w, "Имя должно содержать от 1 до 20 символов", 400)
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	valid := false
	if a := s.attempts[req.ID]; a != nil && a.done && a.Token == req.Token && req.Player >= 0 && req.Player < a.Count {
		valid = true
	}
	for _, room := range s.rooms {
		if room.ID == req.ID && room.Phase == "finished" && req.Player >= 0 && req.Player < len(room.Members) && room.Members[req.Player].token == req.Token {
			valid = true
		}
	}
	if !valid {
		http.Error(w, "Недопустимая сессия", 403)
		return
	}
	res, err := s.db.Exec("UPDATE results SET name=? WHERE match_id=? AND player=? AND name IS NULL", name, req.ID, req.Player)
	if err != nil {
		http.Error(w, "Не удалось записать имя", 500)
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		http.Error(w, "Результат уже записан или игрок не победил", 409)
		return
	}
	send(w, map[string]bool{"ok": true})
}
func (s *Server) ranking(w http.ResponseWriter, r *http.Request) {
	current := week(time.Now())
	rows, err := s.db.Query("SELECT name,score FROM results WHERE week=? AND name IS NOT NULL ORDER BY score DESC,finished ASC,match_id ASC,player ASC LIMIT 100", current)
	if err != nil {
		http.Error(w, "Рейтинг недоступен", 500)
		return
	}
	defer rows.Close()
	type Entry struct {
		Name  string `json:"name"`
		Score int    `json:"score"`
	}
	entries := []Entry{}
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.Name, &e.Score); err != nil {
			http.Error(w, "Рейтинг недоступен", 500)
			return
		}
		entries = append(entries, e)
	}
	send(w, map[string]any{"week": current, "entries": entries})
}
func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
func openDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	_, err = db.Exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS results(match_id TEXT NOT NULL,player INTEGER NOT NULL,score INTEGER NOT NULL,week TEXT NOT NULL,finished INTEGER NOT NULL,name TEXT,PRIMARY KEY(match_id,player)); CREATE INDEX IF NOT EXISTS ranking_week ON results(week,score DESC);")
	return db, err
}
func main() {
	db, err := openDB(env("DB_PATH", "jump.sqlite"))
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	s := &Server{rooms: map[string]*Room{}, attempts: map[string]*Attempt{}, limits: map[string][]time.Time{}, db: db, origin: env("PUBLIC_ORIGIN", "http://localhost:5173")}
	stop := make(chan struct{})
	defer close(stop)
	go s.loop(stop)
	httpServer := &http.Server{Addr: env("LISTEN_ADDR", ":8080"), Handler: s.routes(), ReadHeaderTimeout: 5 * time.Second, IdleTimeout: 60 * time.Second}
	log.Printf("listening on %s", httpServer.Addr)
	if err := httpServer.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
