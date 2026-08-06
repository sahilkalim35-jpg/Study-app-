import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Play, Square, Plus, ChevronRight, ChevronDown, ChevronLeft, BookOpen,
  Clock, Trash2, Flame, X, ClipboardList, BarChart2, Settings as SettingsIcon,
  User, Bell, Download, Upload, Info, Check, Pencil
} from "lucide-react";

// ---------- Material flat theme ----------
const C = {
  bg: "#F4F3F8",
  surface: "#FFFFFF",
  surfaceAlt: "#ECE9F6",
  border: "#E3E0EC",
  text: "#1C1B1F",
  muted: "#6B6976",
  faint: "#9C99A6",
  primary: "#5B4FE9",
  primarySoft: "#EDEBFC",
  onPrimary: "#FFFFFF",
  green: "#2E7D32",
  greenSoft: "#E8F5E9",
  red: "#D32F2F",
  amber: "#F59E0B",
};
const font = "'Roboto', system-ui, -apple-system, 'Segoe UI', sans-serif";
const elevation1 = "0 1px 2px rgba(28,27,31,0.08), 0 1px 3px rgba(28,27,31,0.10)";
const elevation2 = "0 2px 6px rgba(28,27,31,0.12), 0 1px 3px rgba(28,27,31,0.08)";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtHMS = (secs) => {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
};
const fmtMin = (secs) => {
  const totalMin = Math.round(secs / 60);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};
const dayLabel = (dateStr) => {
  const [y, mo, da] = dateStr.split("-").map(Number);
  const d = new Date(y, mo - 1, da);
  return d.toLocaleDateString(undefined, { weekday: "short" });
};

const STORAGE_KEY = "study-tracker-data";

// Works both inside Claude artifacts (window.storage) and as a standalone
// app built via Capacitor (falls back to localStorage there).
const storageAdapter = {
  async get(key) {
    if (typeof window !== "undefined" && window.storage) {
      try {
        const r = await window.storage.get(key, false);
        return r ? r.value : null;
      } catch (e) {
        return null;
      }
    }
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    if (typeof window !== "undefined" && window.storage) {
      try {
        await window.storage.set(key, value, false);
        return;
      } catch (e) {
        /* fall through to localStorage */
      }
    }
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* ignore */
    }
  },
};

const DEFAULT_DATA = {
  subjects: [],
  sessions: [],
  profile: { name: "Student" },
  settings: { dailyReminder: false, streakAlerts: true },
};

export default function StudyTracker() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("today");
  const [timer, setTimer] = useState(null);
  const [, setTick] = useState(0);
  const saveTimeout = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await storageAdapter.get(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setData({
            subjects: parsed.subjects || [],
            sessions: parsed.sessions || [],
            profile: { ...DEFAULT_DATA.profile, ...(parsed.profile || {}) },
            settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) },
          });
        }
      } catch (e) {
        /* first run */
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback((next) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      storageAdapter.set(STORAGE_KEY, JSON.stringify(next));
    }, 300);
  }, []);

  const updateData = useCallback((updater) => {
    setData((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      persist(next);
      return next;
    });
  }, [persist]);

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  const elapsed = timer ? Math.floor((Date.now() - timer.startedAt) / 1000) : 0;

  const startTimer = (subjectId, chapterId, taskId) => {
    if (timer) return;
    setTimer({ subjectId, chapterId, taskId, startedAt: Date.now() });
  };

  const stopTimer = () => {
    if (!timer) return;
    const secs = Math.floor((Date.now() - timer.startedAt) / 1000);
    if (secs >= 5) {
      const subject = data.subjects.find((s) => s.id === timer.subjectId);
      const chapter = subject?.chapters.find((c) => c.id === timer.chapterId);
      const task = chapter?.tasks.find((t) => t.id === timer.taskId);
      const session = {
        id: uid(),
        subjectId: timer.subjectId,
        chapterId: timer.chapterId,
        taskId: timer.taskId,
        subjectName: subject?.name || "Unknown",
        chapterName: chapter?.name || "Unknown",
        taskName: task?.name || "Unknown",
        seconds: secs,
        date: todayStr(),
        loggedAt: Date.now(),
      };
      updateData((prev) => ({ ...prev, sessions: [session, ...prev.sessions] }));
    }
    setTimer(null);
  };

  const addManualSession = (session) => updateData((p) => ({ ...p, sessions: [session, ...p.sessions] }));
  const deleteSession = (id) => updateData((p) => ({ ...p, sessions: p.sessions.filter((s) => s.id !== id) }));

  const addSubject = (name) => updateData((p) => ({ ...p, subjects: [...p.subjects, { id: uid(), name, chapters: [] }] }));
  const addChapter = (subjectId, name) => updateData((p) => ({
    ...p,
    subjects: p.subjects.map((s) => s.id === subjectId ? { ...s, chapters: [...s.chapters, { id: uid(), name, tasks: [] }] } : s),
  }));
  const addTask = (subjectId, chapterId, name) => updateData((p) => ({
    ...p,
    subjects: p.subjects.map((s) => s.id !== subjectId ? s : {
      ...s,
      chapters: s.chapters.map((c) => c.id === chapterId ? { ...c, tasks: [...c.tasks, { id: uid(), name }] } : c),
    }),
  }));
  const deleteSubject = (subjectId) => updateData((p) => ({ ...p, subjects: p.subjects.filter((s) => s.id !== subjectId) }));
  const deleteChapter = (subjectId, chapterId) => updateData((p) => ({
    ...p,
    subjects: p.subjects.map((s) => s.id !== subjectId ? s : { ...s, chapters: s.chapters.filter((c) => c.id !== chapterId) }),
  }));
  const deleteTask = (subjectId, chapterId, taskId) => updateData((p) => ({
    ...p,
    subjects: p.subjects.map((s) => s.id !== subjectId ? s : {
      ...s,
      chapters: s.chapters.map((c) => c.id !== chapterId ? c : { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }),
    }),
  }));

  const updateProfile = (profile) => updateData((p) => ({ ...p, profile: { ...p.profile, ...profile } }));
  const updateSettings = (settings) => updateData((p) => ({ ...p, settings: { ...p.settings, ...settings } }));

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `study-ledger-backup-${todayStr()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const next = {
          subjects: parsed.subjects || [],
          sessions: parsed.sessions || [],
          profile: { ...DEFAULT_DATA.profile, ...(parsed.profile || {}) },
          settings: { ...DEFAULT_DATA.settings, ...(parsed.settings || {}) },
        };
        updateData(next);
      } catch (err) {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  if (!loaded) {
    return (
      <div style={{ background: C.bg, color: C.muted, fontFamily: font }} className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: font }} className="min-h-screen pb-20">
      <Header timer={timer} elapsed={elapsed} onStop={stopTimer} data={data} tab={tab} />
      <main className="max-w-md mx-auto px-4 pt-4">
        {tab === "today" && (
          <TodayView data={data} timer={timer} elapsed={elapsed} onStart={startTimer} onStop={stopTimer}
            onDeleteSession={deleteSession} onAddManualSession={addManualSession} />
        )}
        {tab === "manage" && (
          <ManageView data={data} onAddSubject={addSubject} onAddChapter={addChapter} onAddTask={addTask}
            onDeleteSubject={deleteSubject} onDeleteChapter={deleteChapter} onDeleteTask={deleteTask} />
        )}
        {tab === "analytics" && <AnalyticsView data={data} />}
        {tab === "settings" && (
          <SettingsView data={data} onUpdateProfile={updateProfile} onUpdateSettings={updateSettings}
            onExport={exportData} onImport={importData} />
        )}
      </main>
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  );
}

// ---------- Header ----------
const TAB_TITLES = { today: "Today", manage: "Subjects", analytics: "Analytics", settings: "Settings" };

function Header({ timer, elapsed, onStop, data, tab }) {
  let label = null;
  if (timer) {
    const subject = data.subjects.find((s) => s.id === timer.subjectId);
    const chapter = subject?.chapters.find((c) => c.id === timer.chapterId);
    const task = chapter?.tasks.find((t) => t.id === timer.taskId);
    label = `${subject?.name || ""} › ${chapter?.name || ""} › ${task?.name || ""}`;
  }
  return (
    <div style={{ background: C.surface, boxShadow: elevation1 }} className="sticky top-0 z-10">
      <div className="max-w-md mx-auto px-4 py-3.5 flex items-center justify-between">
        <div className="text-lg font-medium">{TAB_TITLES[tab] || "Study Time"}</div>
        {timer && (
          <button
            onClick={onStop}
            style={{ background: C.primary, color: C.onPrimary }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium active:opacity-85"
          >
            <Square size={12} fill={C.onPrimary} />
            <span>{fmtHMS(elapsed)}</span>
          </button>
        )}
      </div>
      {timer && (
        <div className="max-w-md mx-auto px-4 pb-2.5 -mt-1.5 text-xs truncate" style={{ color: C.primary }}>
          {label}
        </div>
      )}
    </div>
  );
}

// ---------- Bottom Nav ----------
function BottomNav({ tab, setTab }) {
  const items = [
    { id: "today", label: "Today", icon: ClipboardList },
    { id: "manage", label: "Subjects", icon: BookOpen },
    { id: "analytics", label: "Analytics", icon: BarChart2 },
    { id: "settings", label: "Settings", icon: SettingsIcon },
  ];
  return (
    <div style={{ background: C.surface, boxShadow: "0 -1px 4px rgba(28,27,31,0.10)" }} className="fixed bottom-0 left-0 right-0 z-10">
      <div className="max-w-md mx-auto grid grid-cols-4 py-1.5">
        {items.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)} className="flex flex-col items-center gap-1 py-1">
              <div
                style={{ background: active ? C.primarySoft : "transparent" }}
                className="px-4 py-1 rounded-full transition-colors"
              >
                <Icon size={20} color={active ? C.primary : C.faint} strokeWidth={active ? 2.3 : 1.8} />
              </div>
              <span className="text-[11px]" style={{ color: active ? C.primary : C.faint, fontWeight: active ? 600 : 400 }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Card helper ----------
function Card({ children, style, className = "" }) {
  return (
    <div style={{ background: C.surface, borderRadius: 16, boxShadow: elevation1, ...style }} className={`p-4 ${className}`}>
      {children}
    </div>
  );
}

// ---------- Today View ----------
function TodayView({ data, timer, elapsed, onStart, onStop, onDeleteSession, onAddManualSession }) {
  const [picking, setPicking] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const today = todayStr();
  const todaysSessions = data.sessions.filter((s) => s.date === today);
  const totalToday = todaysSessions.reduce((a, s) => a + s.seconds, 0);
  const hasAnySubject = data.subjects.length > 0;

  return (
    <div className="space-y-4">
      <Card className="flex items-center justify-between">
        <div>
          <div className="text-xs" style={{ color: C.muted }}>Logged today</div>
          <div className="text-2xl font-medium mt-0.5">{fmtMin(totalToday)}</div>
        </div>
        <div style={{ background: C.primarySoft }} className="p-3 rounded-full">
          <Clock size={22} style={{ color: C.primary }} />
        </div>
      </Card>

      {!timer ? (
        hasAnySubject ? (
          <button
            onClick={() => setPicking(true)}
            style={{ background: C.primary, color: C.onPrimary, boxShadow: elevation2 }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium active:opacity-90"
          >
            <Play size={17} fill={C.onPrimary} /> Start studying
          </button>
        ) : (
          <div style={{ border: `1.5px dashed ${C.border}`, color: C.muted, borderRadius: 16 }} className="px-4 py-5 text-sm text-center">
            Add a subject in the <span style={{ color: C.primary, fontWeight: 500 }}>Subjects</span> tab to start logging time.
          </div>
        )
      ) : (
        <Card style={{ background: C.primarySoft }} className="flex items-center justify-between">
          <div className="text-3xl font-medium" style={{ color: C.primary }}>{fmtHMS(elapsed)}</div>
          <button onClick={onStop} style={{ background: C.red }} className="p-3 rounded-full active:opacity-85">
            <Square size={16} fill="#fff" color="#fff" />
          </button>
        </Card>
      )}

      {picking && (
        <TaskPicker data={data} onCancel={() => setPicking(false)}
          onPick={(subjectId, chapterId, taskId) => { onStart(subjectId, chapterId, taskId); setPicking(false); }} />
      )}

      <button onClick={() => setManualOpen((v) => !v)} className="text-xs flex items-center gap-1" style={{ color: C.muted }}>
        <Plus size={13} /> Log a past session
      </button>
      {manualOpen && (
        <ManualLogForm data={data} onCancel={() => setManualOpen(false)}
          onSave={(session) => { onAddManualSession(session); setManualOpen(false); }} />
      )}

      <div>
        <div className="text-sm font-medium mb-2 mt-6" style={{ color: C.muted }}>Today's entries</div>
        {todaysSessions.length === 0 ? (
          <div className="text-sm py-6 text-center" style={{ color: C.faint }}>No sessions logged yet today.</div>
        ) : (
          <Card style={{ padding: 0 }}>
            {todaysSessions.map((s, i) => (
              <LedgerRow key={s.id} session={s} last={i === todaysSessions.length - 1} onDelete={() => onDeleteSession(s.id)} />
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function LedgerRow({ session, last, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div style={{ borderBottom: last ? "none" : `1px solid ${C.border}` }} className="flex items-center justify-between px-4 py-3">
      <div className="min-w-0 pr-2">
        <div className="text-sm font-medium truncate">{session.taskName}</div>
        <div className="text-xs truncate" style={{ color: C.muted }}>{session.subjectName} › {session.chapterName}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span style={{ color: C.primary }} className="text-sm font-medium">{fmtMin(session.seconds)}</span>
        {confirm ? (
          <button onClick={onDelete} style={{ color: C.red }} className="text-xs underline">confirm</button>
        ) : (
          <button onClick={() => setConfirm(true)} style={{ color: C.faint }}><Trash2 size={14} /></button>
        )}
      </div>
    </div>
  );
}

function TaskPicker({ data, onPick, onCancel }) {
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id || "");
  const subject = data.subjects.find((s) => s.id === subjectId);
  const [chapterId, setChapterId] = useState(subject?.chapters[0]?.id || "");
  const chapter = subject?.chapters.find((c) => c.id === chapterId);
  const [taskId, setTaskId] = useState(chapter?.tasks[0]?.id || "");

  useEffect(() => { setChapterId(data.subjects.find((s) => s.id === subjectId)?.chapters[0]?.id || ""); }, [subjectId]); // eslint-disable-line
  useEffect(() => { setTaskId(subject?.chapters.find((c) => c.id === chapterId)?.tasks[0]?.id || ""); }, [chapterId]); // eslint-disable-line

  return (
    <Card className="space-y-3">
      <Select label="Subject" value={subjectId} onChange={setSubjectId} options={data.subjects.map((s) => [s.id, s.name])} />
      <Select label="Chapter" value={chapterId} onChange={setChapterId} options={(subject?.chapters || []).map((c) => [c.id, c.name])} />
      <Select label="Task" value={taskId} onChange={setTaskId} options={(chapter?.tasks || []).map((t) => [t.id, t.name])} />
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-full text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.muted }}>Cancel</button>
        <button disabled={!taskId} onClick={() => onPick(subjectId, chapterId, taskId)}
          style={{ background: taskId ? C.primary : C.surfaceAlt, color: taskId ? C.onPrimary : C.faint }}
          className="flex-1 py-2.5 rounded-full text-sm font-medium">Start</button>
      </div>
    </Card>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <div className="text-xs mb-1" style={{ color: C.muted }}>{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.text }}
        className="w-full rounded-xl px-3 py-2.5 text-sm">
        {options.length === 0 && <option value="">—</option>}
        {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
  );
}

function ManualLogForm({ data, onSave, onCancel }) {
  const [subjectId, setSubjectId] = useState(data.subjects[0]?.id || "");
  const subject = data.subjects.find((s) => s.id === subjectId);
  const [chapterId, setChapterId] = useState(subject?.chapters[0]?.id || "");
  const chapter = subject?.chapters.find((c) => c.id === chapterId);
  const [taskId, setTaskId] = useState(chapter?.tasks[0]?.id || "");
  const [minutes, setMinutes] = useState(25);
  const [date, setDate] = useState(todayStr());

  useEffect(() => { setChapterId(data.subjects.find((s) => s.id === subjectId)?.chapters[0]?.id || ""); }, [subjectId]); // eslint-disable-line
  useEffect(() => { setTaskId(subject?.chapters.find((c) => c.id === chapterId)?.tasks[0]?.id || ""); }, [chapterId]); // eslint-disable-line

  if (data.subjects.length === 0) return <div className="text-sm" style={{ color: C.muted }}>Add a subject first in the Subjects tab.</div>;

  const task = chapter?.tasks.find((t) => t.id === taskId);

  return (
    <Card className="space-y-3">
      <Select label="Subject" value={subjectId} onChange={setSubjectId} options={data.subjects.map((s) => [s.id, s.name])} />
      <Select label="Chapter" value={chapterId} onChange={setChapterId} options={(subject?.chapters || []).map((c) => [c.id, c.name])} />
      <Select label="Task" value={taskId} onChange={setTaskId} options={(chapter?.tasks || []).map((t) => [t.id, t.name])} />
      <div className="flex gap-3">
        <label className="flex-1">
          <div className="text-xs mb-1" style={{ color: C.muted }}>Minutes</div>
          <input type="number" min="1" value={minutes} onChange={(e) => setMinutes(e.target.value)}
            style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.text }}
            className="w-full rounded-xl px-3 py-2.5 text-sm" />
        </label>
        <label className="flex-1">
          <div className="text-xs mb-1" style={{ color: C.muted }}>Date</div>
          <input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)}
            style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.text }}
            className="w-full rounded-xl px-3 py-2.5 text-sm" />
        </label>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-full text-sm font-medium" style={{ border: `1px solid ${C.border}`, color: C.muted }}>Cancel</button>
        <button disabled={!taskId || !minutes} onClick={() => onSave({
          id: uid(), subjectId, chapterId, taskId,
          subjectName: subject?.name, chapterName: chapter?.name, taskName: task?.name,
          seconds: Number(minutes) * 60, date, loggedAt: Date.now(),
        })} style={{ background: C.primary, color: C.onPrimary }} className="flex-1 py-2.5 rounded-full text-sm font-medium">Save entry</button>
      </div>
    </Card>
  );
}

// ---------- Manage View ----------
function ManageView({ data, onAddSubject, onAddChapter, onAddTask, onDeleteSubject, onDeleteChapter, onDeleteTask }) {
  const [newSubject, setNewSubject] = useState("");
  const [expanded, setExpanded] = useState({});

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="New subject (e.g. Organic Chemistry)"
          style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, boxShadow: elevation1 }}
          className="flex-1 rounded-xl px-3 py-2.5 text-sm" />
        <button onClick={() => { if (newSubject.trim()) { onAddSubject(newSubject.trim()); setNewSubject(""); } }}
          style={{ background: C.primary, color: C.onPrimary }} className="px-4 rounded-xl"><Plus size={18} /></button>
      </div>

      {data.subjects.length === 0 && (
        <div className="text-sm text-center py-8" style={{ color: C.faint }}>No subjects yet. Add your first one above.</div>
      )}

      {data.subjects.map((subject) => (
        <SubjectCard key={subject.id} subject={subject} expanded={!!expanded[subject.id]}
          onToggle={() => setExpanded((e) => ({ ...e, [subject.id]: !e[subject.id] }))}
          onAddChapter={(name) => onAddChapter(subject.id, name)}
          onAddTask={(chapterId, name) => onAddTask(subject.id, chapterId, name)}
          onDeleteSubject={() => onDeleteSubject(subject.id)}
          onDeleteChapter={(chapterId) => onDeleteChapter(subject.id, chapterId)}
          onDeleteTask={(chapterId, taskId) => onDeleteTask(subject.id, chapterId, taskId)} />
      ))}
    </div>
  );
}

function SubjectCard({ subject, expanded, onToggle, onAddChapter, onAddTask, onDeleteSubject, onDeleteChapter, onDeleteTask }) {
  const [newChapter, setNewChapter] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const totalTasks = subject.chapters.reduce((a, c) => a + c.tasks.length, 0);

  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? <ChevronDown size={16} color={C.muted} /> : <ChevronRight size={16} color={C.muted} />}
          <span className="font-medium truncate">{subject.name}</span>
        </div>
        <span className="text-xs shrink-0" style={{ color: C.faint }}>{subject.chapters.length} ch · {totalTasks} tasks</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
          {subject.chapters.map((chapter) => (
            <ChapterRow key={chapter.id} chapter={chapter} onAddTask={(name) => onAddTask(chapter.id, name)}
              onDeleteChapter={() => onDeleteChapter(chapter.id)} onDeleteTask={(taskId) => onDeleteTask(chapter.id, taskId)} />
          ))}
          <div className="flex gap-2 pt-1">
            <input value={newChapter} onChange={(e) => setNewChapter(e.target.value)} placeholder="New chapter"
              style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.text }}
              className="flex-1 rounded-lg px-2.5 py-2 text-sm" />
            <button onClick={() => { if (newChapter.trim()) { onAddChapter(newChapter.trim()); setNewChapter(""); } }}
              style={{ background: C.primarySoft, color: C.primary }} className="px-3 rounded-lg text-sm"><Plus size={14} /></button>
          </div>
          <div className="pt-1">
            {confirmDel ? (
              <button onClick={onDeleteSubject} className="text-xs underline" style={{ color: C.red }}>Confirm delete subject</button>
            ) : (
              <button onClick={() => setConfirmDel(true)} className="text-xs" style={{ color: C.faint }}>Delete subject</button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function ChapterRow({ chapter, onAddTask, onDeleteChapter, onDeleteTask }) {
  const [open, setOpen] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <div style={{ background: C.surfaceAlt, borderRadius: 12 }} className="px-3 py-2.5">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          {open ? <ChevronDown size={13} color={C.muted} /> : <ChevronRight size={13} color={C.muted} />}
          <span className="text-sm truncate">{chapter.name}</span>
        </div>
        <span className="text-xs shrink-0" style={{ color: C.faint }}>{chapter.tasks.length}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 pl-4">
          {chapter.tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between text-sm">
              <span className="truncate">{task.name}</span>
              <button onClick={() => onDeleteTask(task.id)} style={{ color: C.faint }}><X size={13} /></button>
            </div>
          ))}
          <div className="flex gap-1.5 pt-1">
            <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="New task"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text }}
              className="flex-1 rounded-lg px-2 py-1.5 text-xs" />
            <button onClick={() => { if (newTask.trim()) { onAddTask(newTask.trim()); setNewTask(""); } }}
              style={{ color: C.primary }} className="text-xs px-1.5"><Plus size={13} /></button>
          </div>
          {confirmDel ? (
            <button onClick={onDeleteChapter} className="text-xs underline" style={{ color: C.red }}>Confirm delete chapter</button>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="text-xs" style={{ color: C.faint }}>Delete chapter</button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Analytics View ----------
function AnalyticsView({ data }) {
  const { sessions } = data;
  const totalAll = sessions.reduce((a, s) => a + s.seconds, 0);

  const days = useMemo(() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    }
    return arr;
  }, []);
  const byDay = days.map((d) => ({ date: d, seconds: sessions.filter((s) => s.date === d).reduce((a, s) => a + s.seconds, 0) }));
  const maxDay = Math.max(1, ...byDay.map((d) => d.seconds));
  const weekTotal = byDay.reduce((a, d) => a + d.seconds, 0);

  const streak = useMemo(() => {
    let count = 0; let d = new Date();
    while (true) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!sessions.some((s) => s.date === key)) break;
      count++; d.setDate(d.getDate() - 1);
    }
    return count;
  }, [sessions]);

  const bySubject = useMemo(() => {
    const map = {};
    sessions.forEach((s) => { map[s.subjectName] = (map[s.subjectName] || 0) + s.seconds; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [sessions]);
  const maxSubject = Math.max(1, ...bySubject.map(([, v]) => v));

  const [selectedSubject, setSelectedSubject] = useState(null);
  const activeSubjectName = selectedSubject || bySubject[0]?.[0];
  const byChapter = useMemo(() => {
    const map = {};
    sessions.filter((s) => s.subjectName === activeSubjectName).forEach((s) => { map[s.chapterName] = (map[s.chapterName] || 0) + s.seconds; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [sessions, activeSubjectName]);
  const maxChapter = Math.max(1, ...byChapter.map(([, v]) => v));

  if (sessions.length === 0) {
    return <div className="text-sm text-center py-10" style={{ color: C.faint }}>No study sessions logged yet. Start a timer from Today to see analytics here.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2.5">
        <StatBox label="This week" value={fmtMin(weekTotal)} />
        <StatBox label="All time" value={fmtMin(totalAll)} />
        <StatBox label="Streak" value={`${streak}d`} icon={streak > 0 ? Flame : null} />
      </div>

      <Card>
        <div className="text-sm font-medium mb-3" style={{ color: C.muted }}>Last 7 days</div>
        <div className="flex items-end justify-between gap-1.5" style={{ height: 100 }}>
          {byDay.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
              <div style={{ width: "100%", height: `${Math.max(4, (d.seconds / maxDay) * 78)}px`, background: d.date === todayStr() ? C.primary : C.surfaceAlt, borderRadius: 6 }} />
              <div className="text-[10px] mt-1.5" style={{ color: C.faint }}>{dayLabel(d.date)}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="text-sm font-medium mb-3" style={{ color: C.muted }}>Time by subject</div>
        <div className="space-y-3">
          {bySubject.map(([name, secs]) => (
            <button key={name} onClick={() => setSelectedSubject(name)} className="w-full text-left">
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: name === activeSubjectName ? C.primary : C.text, fontWeight: name === activeSubjectName ? 600 : 400 }}>{name}</span>
                <span style={{ color: C.muted }}>{fmtMin(secs)}</span>
              </div>
              <div style={{ background: C.surfaceAlt, height: 8, borderRadius: 999 }} className="overflow-hidden">
                <div style={{ width: `${(secs / maxSubject) * 100}%`, background: name === activeSubjectName ? C.primary : C.faint, height: "100%", borderRadius: 999 }} />
              </div>
            </button>
          ))}
        </div>
      </Card>

      {activeSubjectName && (
        <Card>
          <div className="text-sm font-medium mb-3" style={{ color: C.muted }}>{activeSubjectName} — by chapter</div>
          <div className="space-y-3">
            {byChapter.map(([name, secs]) => (
              <div key={name}>
                <div className="flex justify-between text-xs mb-1"><span>{name}</span><span style={{ color: C.muted }}>{fmtMin(secs)}</span></div>
                <div style={{ background: C.surfaceAlt, height: 8, borderRadius: 999 }} className="overflow-hidden">
                  <div style={{ width: `${(secs / maxChapter) * 100}%`, background: C.green, height: "100%", borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatBox({ label, value, icon: Icon }) {
  return (
    <Card className="text-center" style={{ padding: "14px 8px" }}>
      <div className="flex items-center justify-center gap-1">
        {Icon && <Icon size={13} color={C.amber} />}
        <div className="text-lg font-medium">{value}</div>
      </div>
      <div className="text-[10px] mt-1" style={{ color: C.faint }}>{label}</div>
    </Card>
  );
}

// ---------- Settings View ----------
function SettingsView({ data, onUpdateProfile, onUpdateSettings, onExport, onImport }) {
  const [view, setView] = useState("list");
  const fileInputRef = useRef(null);

  if (view === "profile") return <ProfileView data={data} onUpdateProfile={onUpdateProfile} onBack={() => setView("list")} />;
  if (view === "notifications") return <NotificationsView data={data} onUpdateSettings={onUpdateSettings} onBack={() => setView("list")} />;
  if (view === "data") return <DataView onExport={onExport} onImport={onImport} onBack={() => setView("list")} />;
  if (view === "about") return <AboutView onBack={() => setView("list")} />;

  const initial = (data.profile?.name || "S").trim().charAt(0).toUpperCase();

  return (
    <div className="space-y-4">
      <button onClick={() => setView("profile")} className="w-full">
        <Card className="flex items-center gap-3">
          <div style={{ background: C.primary, color: C.onPrimary }} className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium shrink-0">
            {initial}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="font-medium truncate">{data.profile?.name || "Student"}</div>
            <div className="text-xs" style={{ color: C.muted }}>View profile</div>
          </div>
          <ChevronRight size={18} color={C.faint} />
        </Card>
      </button>

      <Card style={{ padding: 0 }}>
        <SettingsRow icon={Bell} label="Notifications" onClick={() => setView("notifications")} />
        <SettingsRow icon={Download} label="Data & backup" onClick={() => setView("data")} />
        <SettingsRow icon={Info} label="About" onClick={() => setView("about")} last />
      </Card>
    </div>
  );
}

function SettingsRow({ icon: Icon, label, onClick, last }) {
  return (
    <button onClick={onClick} style={{ borderBottom: last ? "none" : `1px solid ${C.border}` }} className="w-full flex items-center gap-3 px-4 py-3.5">
      <div style={{ background: C.primarySoft }} className="p-2 rounded-full"><Icon size={16} color={C.primary} /></div>
      <span className="flex-1 text-left text-sm font-medium">{label}</span>
      <ChevronRight size={17} color={C.faint} />
    </button>
  );
}

function SettingsHeader({ title, onBack }) {
  return (
    <div className="flex items-center gap-2 mb-4 -mt-1">
      <button onClick={onBack} style={{ color: C.muted }} className="p-1 -ml-1"><ChevronLeft size={22} /></button>
      <div className="font-medium text-base">{title}</div>
    </div>
  );
}

function ProfileView({ data, onUpdateProfile, onBack }) {
  const [name, setName] = useState(data.profile?.name || "");
  const [editing, setEditing] = useState(false);
  const totalAll = data.sessions.reduce((a, s) => a + s.seconds, 0);
  const daysStudied = new Set(data.sessions.map((s) => s.date)).size;
  const initial = (name || "S").trim().charAt(0).toUpperCase();

  const save = () => { onUpdateProfile({ name: name.trim() || "Student" }); setEditing(false); };

  return (
    <div>
      <SettingsHeader title="Profile" onBack={onBack} />
      <Card className="flex flex-col items-center text-center py-6 mb-4">
        <div style={{ background: C.primary, color: C.onPrimary }} className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-medium mb-3">
          {initial}
        </div>
        {editing ? (
          <div className="w-full flex gap-2 mt-1">
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
              style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, color: C.text }}
              className="flex-1 rounded-xl px-3 py-2 text-sm text-center" />
            <button onClick={save} style={{ background: C.primary, color: C.onPrimary }} className="p-2 rounded-xl"><Check size={16} /></button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5">
            <span className="font-medium text-lg">{data.profile?.name || "Student"}</span>
            <Pencil size={13} color={C.faint} />
          </button>
        )}
      </Card>
      <div className="grid grid-cols-2 gap-2.5">
        <StatBox label="Total time" value={fmtMin(totalAll)} />
        <StatBox label="Days studied" value={daysStudied} />
        <StatBox label="Sessions" value={data.sessions.length} />
        <StatBox label="Subjects" value={data.subjects.length} />
      </div>
    </div>
  );
}

function NotificationsView({ data, onUpdateSettings, onBack }) {
  const settings = data.settings || {};
  return (
    <div>
      <SettingsHeader title="Notifications" onBack={onBack} />
      <Card style={{ padding: 0 }}>
        <ToggleRow label="Daily study reminder" desc="A nudge if you haven't logged time today" checked={!!settings.dailyReminder}
          onChange={(v) => onUpdateSettings({ dailyReminder: v })} />
        <ToggleRow label="Streak alerts" desc="Get notified when your streak is at risk" checked={!!settings.streakAlerts}
          onChange={(v) => onUpdateSettings({ streakAlerts: v })} last />
      </Card>
      <div className="text-xs mt-3 px-1" style={{ color: C.faint }}>
        These preferences are saved on-device. Actual push notifications require native permission setup in your Capacitor build.
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange, last }) {
  return (
    <div style={{ borderBottom: last ? "none" : `1px solid ${C.border}` }} className="flex items-center justify-between px-4 py-3.5 gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs mt-0.5" style={{ color: C.muted }}>{desc}</div>}
      </div>
      <button onClick={() => onChange(!checked)} style={{ background: checked ? C.primary : C.border }}
        className="w-11 h-6 rounded-full relative shrink-0 transition-colors">
        <div style={{ transform: checked ? "translateX(20px)" : "translateX(2px)" }} className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform shadow" />
      </button>
    </div>
  );
}

function DataView({ onExport, onImport, onBack }) {
  const fileInputRef = useRef(null);
  return (
    <div>
      <SettingsHeader title="Data & backup" onBack={onBack} />
      <Card style={{ padding: 0 }}>
        <SettingsRow icon={Download} label="Export backup (.json)" onClick={onExport} />
        <SettingsRow icon={Upload} label="Restore from backup" onClick={() => fileInputRef.current?.click()} last />
      </Card>
      <input ref={fileInputRef} type="file" accept="application/json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
      <div className="text-xs mt-3 px-1" style={{ color: C.faint }}>
        Export saves all subjects, sessions and settings as a JSON file. Restoring will replace your current data.
      </div>
    </div>
  );
}

function AboutView({ onBack }) {
  return (
    <div>
      <SettingsHeader title="About" onBack={onBack} />
      <Card className="text-center py-6 mb-3">
        <div style={{ background: C.primary, color: C.onPrimary }} className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <BookOpen size={26} />
        </div>
        <div className="font-medium">Study Time</div>
        <div className="text-xs mt-1" style={{ color: C.muted }}>Version 1.0.0</div>
      </Card>
      <Card>
        <p className="text-sm" style={{ color: C.muted }}>
          A simple study time logger — track subjects, chapters and tasks, log focused sessions, and see your progress over time.
        </p>
      </Card>
    </div>
  );
}
