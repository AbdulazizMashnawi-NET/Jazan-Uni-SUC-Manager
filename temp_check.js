
        const { useState, useMemo, useEffect, useCallback } = React;

        const DAY_MAP = { "1": "SUN", "2": "MON", "3": "TUE", "4": "WED", "5": "THU" };
        const DAY_LABELS = { SUN: "الأحد", MON: "الاثنين", TUE: "الثلاثاء", WED: "الأربعاء", THU: "الخميس" };
        const DAYS = ["SUN", "MON", "TUE", "WED", "THU"];

        const GRID_START = 8;
        const GRID_END = 22;
        const HOURS = Array.from({ length: GRID_END - GRID_START }, (_, i) => i + GRID_START);

        const isSectionOpen = (status) => /مفتوح/.test(status || "");
        const isSectionClosed = (status) => /مغلق/.test(status || "");

        // ✅ FIX: تحسين مظهر الوقت (بدون صفر مزعج للساعات في صيغة 12)
        const formatTime = (timeStr, use12h) => {
            if (!timeStr) return "";
            if (!use12h) return timeStr; 
            const [h, m] = timeStr.split(':').map(Number);
            const ampm = h >= 12 ? 'م' : 'ص';
            let h12 = h % 12;
            h12 = h12 ? h12 : 12; 
            return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
        };

        function parseTimeArabic(t) {
            if (!t) return "";
            const isPm = /م|p/i.test(t);
            const isAm = /ص|a/i.test(t);
            const clean = t.replace(/[^\d:]/g, ""); 
            let parts = clean.split(":");
            if (parts.length < 2) return "";
            let h = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
            if (isNaN(h) || isNaN(m)) return "";
            if (isPm && h !== 12) h += 12;
            else if (isAm && h === 12) h = 0;
            else if (!isPm && !isAm && h >= 1 && h <= 6) h += 12;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        }

        function parseSectionField(raw) {
            if (!raw) return [];
            const slots = raw.split("@n");
            const result = [];
            slots.forEach(slot => {
                if (!slot.includes("@t")) return;
                const index = slot.indexOf("@t");
                const daysPart = slot.slice(0, index);
                const rest = slot.slice(index + 2);
                if (!rest) return;
                const days = daysPart.trim().split(/\s+/).map(n => DAY_MAP[n]).filter(Boolean);
                const timeMatch = rest.match(/(\d{1,2}:\d{2}\s*[مصap\.m]*)\s*[-–]\s*(\d{1,2}:\d{2}\s*[مصap\.m]*)/i);
                if (timeMatch && days.length > 0) {
                    result.push({ days, start: parseTimeArabic(timeMatch[1]), end: parseTimeArabic(timeMatch[2]) });
                }
            });
            return result;
        }

        function timeToMin(t) {
            if (!t) return 0;
            const [h, m] = t.split(":").map(Number);
            return h * 60 + m;
        }

        function hasConflict(s1, s2) {
            const sharedDay = s1.days.some(d => s2.days.includes(d));
            if (!sharedDay) return false;
            return timeToMin(s1.start) < timeToMin(s2.end) && timeToMin(s2.start) < timeToMin(s1.end);
        }

        function scoreSchedule(schedule) {
            let score = 0;
            const daysUsed = new Set();
            let totalEndMins = 0;
            schedule.forEach(sec => {
                sec.slots.forEach(slot => {
                    slot.days.forEach(d => daysUsed.add(d));
                    totalEndMins += timeToMin(slot.end);
                });
            });
            score += (5 - daysUsed.size) * 5000;
            score -= totalEndMins; 
            return score;
        }

        function getValidCourseConfigs(course, hideClosed) {
            const types = Object.keys(course.types);
            let configs = [[]];
            for (const type of types) {
                let available = course.types[type];
                if (hideClosed) available = available.filter(s => isSectionOpen(s.status));
                const newConfigs = [];
                for (const config of configs) {
                    for (const sec of available) {
                        if (!config.some(prevSec => prevSec.slots.some(s1 => sec.slots.some(s2 => hasConflict(s1, s2))))) {
                            newConfigs.push([...config, sec]);
                        }
                    }
                }
                configs = newConfigs;
            }
            return configs;
        }

        function courseMatchesFilters(course, textFilter, days, instructors) {
            const allSections = Object.values(course.types).flat();
            const query = (textFilter || "").trim();
            const matchesText = !query
                || course.name.includes(query)
                || course.id.toLowerCase().includes(query.toLowerCase());
            const matchesDay = days.length === 0
                || allSections.some(section => section.slots.some(slot => days.some(day => slot.days.includes(day))));
            const matchesInstructor = instructors.length === 0
                || allSections.some(section => instructors.includes(section.instructor));
            return matchesText && matchesDay && matchesInstructor;
        }

        function isStrictConflict(c1, c2, hideClosed) {
            const configs1 = getValidCourseConfigs(c1, hideClosed);
            const configs2 = getValidCourseConfigs(c2, hideClosed);
            if (configs1.length === 0 || configs2.length === 0) return true;
            for (const cfg1 of configs1) {
                for (const cfg2 of configs2) {
                    let overlap = false;
                    for (const s1 of cfg1) {
                        for (const s2 of cfg2) {
                            if (s1.slots.some(sl1 => s2.slots.some(sl2 => hasConflict(sl1, sl2)))) overlap = true;
                        }
                    }
                    if (!overlap) return false;
                }
            }
            return true;
        }

        const PALETTES = {
            default: [
                { bg: "#3b82f6", light: "rgba(59, 130, 246, 0.12)", border: "#93c5fd", darkText: "#93c5fd" },
                { bg: "#10b981", light: "rgba(16, 185, 129, 0.12)", border: "#6ee7b7", darkText: "#6ee7b7" },
                { bg: "#f59e0b", light: "rgba(245, 158, 11, 0.12)", border: "#fcd34d", darkText: "#fcd34d" },
                { bg: "#8b5cf6", light: "rgba(139, 92, 246, 0.12)", border: "#c4b5fd", darkText: "#c4b5fd" },
                { bg: "#ef4444", light: "rgba(239, 68, 68, 0.12)", border: "#fca5a5", darkText: "#fca5a5" },
                { bg: "#06b6d4", light: "rgba(6, 182, 212, 0.12)", border: "#67e8f9", darkText: "#67e8f9" },
            ],
            pastel: [
                { bg: "#fca5a5", light: "rgba(252, 165, 165, 0.12)", border: "#fecaca", darkText: "#fecaca" },
                { bg: "#86efac", light: "rgba(134, 239, 172, 0.12)", border: "#bbf7d0", darkText: "#bbf7d0" },
                { bg: "#93c5fd", light: "rgba(147, 197, 253, 0.12)", border: "#bfdbfe", darkText: "#bfdbfe" },
                { bg: "#c4b5fd", light: "rgba(196, 181, 253, 0.12)", border: "#ddd6fe", darkText: "#ddd6fe" },
                { bg: "#fde047", light: "rgba(253, 224, 71, 0.12)", border: "#fef08a", darkText: "#fef08a" },
                { bg: "#f9a8d4", light: "rgba(249, 168, 212, 0.12)", border: "#fbcfe8", darkText: "#fbcfe8" },
            ],
            neon: [
                { bg: "#ff007f", light: "rgba(255, 0, 127, 0.12)", border: "#ff4da6", darkText: "#ff4da6" },
                { bg: "#00f0ff", light: "rgba(0, 240, 255, 0.12)", border: "#4dffff", darkText: "#4dffff" },
                { bg: "#bfff00", light: "rgba(191, 255, 0, 0.12)", border: "#d9ff4d", darkText: "#d9ff4d" },
                { bg: "#ff00ff", light: "rgba(255, 0, 255, 0.12)", border: "#ff4dff", darkText: "#ff4dff" },
                { bg: "#ffaa00", light: "rgba(255, 170, 0, 0.12)", border: "#ffcc4d", darkText: "#ffcc4d" },
                { bg: "#00ff7f", light: "rgba(0, 255, 127, 0.12)", border: "#4dff99", darkText: "#4dff99" },
            ]
        };
        const COLORS = PALETTES['default'];

        function TimeGrid({ sections, courseColors, use12h, darkMode }) {
            const CELL_HEIGHT = 50;
            const TOTAL_HOURS = GRID_END - GRID_START;
            const GRID_HEIGHT = TOTAL_HOURS * CELL_HEIGHT;
            const HEADER_HEIGHT = 45;

            return (
                <div className="table-responsive">
                    <div id="schedule-grid" style={{ background: "var(--card-bg)", borderRadius: "12px", border: "1px solid var(--border-color)", overflow: "hidden", display: "flex", direction: "rtl", boxShadow: "var(--shadow)" }}>
                        <div className="time-col">
                            <div className="grid-header" style={{ height: `${HEADER_HEIGHT}px`, fontSize: "11px", color: "var(--text-muted)", fontWeight: "bold" }}>⏰ الوقت</div>
                            <div style={{ height: `${GRID_HEIGHT}px`, display: "flex", flexDirection: "column" }}>
                                {HOURS.map(h => (
                                    <div key={h} className="time-cell" style={{ height: `${CELL_HEIGHT}px` }}>
                                        <span className="time-cell-badge">
                                            {formatTime(`${String(h).padStart(2, '0')}:00`, use12h)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                            {DAYS.map((d, colIdx) => (
                                <div key={d} className="day-col">
                                    <div className="grid-header" style={{ height: `${HEADER_HEIGHT}px` }}>{DAY_LABELS[d]}</div>
                                    <div style={{ height: `${GRID_HEIGHT}px`, position: "relative" }}>
                                        {HOURS.map(h => (
                                            <div key={h} className="grid-cell" style={{ height: `${CELL_HEIGHT}px` }} />
                                        ))}

                                        {sections.map(sec => {
                                            const colorObj = courseColors[sec.courseId] || COLORS[0];
                                            const isOpen = isSectionOpen(sec.status);

                                            return sec.slots.flatMap((slot, slotIdx) => {
                                                if (!slot.days.includes(d) || !slot.start || !slot.end) return null;

                                                const startMin = timeToMin(slot.start) - GRID_START * 60;
                                                const durMin = timeToMin(slot.end) - timeToMin(slot.start);
                                                if (startMin < 0 || durMin <= 0) return null;

                                                const topPx = (startMin / 60) * CELL_HEIGHT;
                                                const heightPx = (durMin / 60) * CELL_HEIGHT;

                                                return (
                                                    <div key={`${sec.id}-${d}-${slotIdx}`} className="time-cell-item" style={{
                                                        position: "absolute", top: `${topPx}px`, left: "3px", right: "3px",
                                                        height: `${Math.max(heightPx, 30)}px`, background: colorObj.light,
                                                        border: `1.5px solid ${colorObj.border}`,
                                                        borderRight: `4px solid ${colorObj.bg}`, borderRadius: "8px",
                                                        padding: "5px", overflow: "visible",
                                                        boxShadow: "0 2px 6px rgba(0,0,0,0.08)", opacity: isOpen ? 1 : 0.65,
                                                        display: "flex", flexDirection: "column", justifyContent: "space-between",
                                                        animation: `popIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) ${colIdx*0.06}s both`, zIndex: 10,
                                                        transition: "all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)"
                                                    }}
                                                    onMouseEnter={e => {
                                                        e.currentTarget.style.transform = "scale(1.05) translateY(-2px)";
                                                        e.currentTarget.style.zIndex = "30";
                                                        e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.18)";
                                                    }}
                                                    onMouseLeave={e => {
                                                        e.currentTarget.style.transform = "scale(1) translateY(0)";
                                                        e.currentTarget.style.zIndex = "10";
                                                        e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.08)";
                                                    }}>
                                                        <div>
                                                            <div style={{ fontWeight: "bold", color: darkMode ? colorObj.darkText : colorObj.bg, fontSize: "10px", lineHeight: "1.3" }}>
                                                                {sec.courseName} <span style={{opacity: 0.8}}>({sec.type})</span>
                                                            </div>
                                                            <div style={{ color: "var(--text-main)", marginTop: "2px", fontSize: "9px", opacity: 0.85 }}>
                                                                {formatTime(slot.start, use12h)} - {formatTime(slot.end, use12h)}
                                                            </div>
                                                        </div>
                                                        {heightPx >= 60 && (
                                                            <div style={{ color: "var(--text-main)", fontWeight: "bold", fontSize: "9px", borderTop: `1px dashed ${colorObj.border}`, paddingTop: "3px", marginTop: "3px", opacity: 0.9 }}>
                                                                👨‍🏫 {sec.instructor} | {sec.id}
                                                            </div>
                                                        )}
                                                        <div className="glass-tooltip no-print">
                                                            <strong>{sec.courseName}</strong>
                                                            <div style={{marginTop: '4px'}}>{sec.courseId} - شعبة {sec.id}</div>
                                                            <div>👨‍🏫 {sec.instructor || "غير محدد"}</div>
                                                            <div>🏢 {slot.room || "غير محدد"}</div>
                                                            <div>⏰ {formatTime(slot.start, use12h)} - {formatTime(slot.end, use12h)}</div>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        }

        function CustomModal({ isOpen, title, message, children, isError, onClose }) {
            if (!isOpen) return null;
            return (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'var(--modal-overlay)', backdropFilter: 'blur(5px)',
                    zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px',
                    animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}>
                    <div style={{
                        background: 'var(--card-bg)', padding: '30px', borderRadius: '20px',
                        maxWidth: '500px', width: '100%', textAlign: 'center',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
                        animation: 'popIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                    }}>
                        <div style={{ fontSize: '48px', marginBottom: '15px' }}>
                            {isError ? '⚠️' : (title.includes('استخراج') ? 'ℹ️' : '✨')}
                        </div>
                        <h2 style={{ margin: '0 0 10px 0', color: 'var(--text-main)', fontSize: '22px' }}>{title}</h2>
                        {message && <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '15px', marginBottom: '20px', whiteSpace: 'pre-wrap' }}>{message}</p>}
                        {children && <div style={{ marginBottom: '25px', textAlign: 'right' }}>{children}</div>}
                        <button className="btn-animate" onClick={onClose} style={{
                            background: isError ? '#ef4444' : '#3b82f6', color: 'white', border: 'none',
                            padding: '12px 30px', borderRadius: '10px', cursor: 'pointer',
                            fontWeight: 'bold', fontSize: '15px', width: '100%'
                        }}>حسناً، فهمت</button>
                    </div>
                </div>
            );
        }

        function App() {
            const [courses, setCourses] = useState([]);
            const [selectedIds, setSelectedIds] = useState([]);
            const [schedules, setSchedules] = useState([]);
            const [currentIdx, setCurrentIdx] = useState(0);
            const [view, setView] = useState("upload");
            const [hideClosed, setHideClosed] = useState(false);
            const [isSummerTerm, setIsSummerTerm] = useState(false);
            const [use12hFormat, setUse12hFormat] = useState(true);
            const [toastText, setToastText] = useState("");
            const [darkMode, setDarkMode] = useState(() => {
                try { return localStorage.getItem('darkMode') === 'true'; } catch { return false; }
            });
            const [instructorFilter, setInstructorFilter] = useState("");
            const [selectedDays, setSelectedDays] = useState([]);
            const [selectedInstructors, setSelectedInstructors] = useState([]);
            const [savedSchedules, setSavedSchedules] = useState(() => {
                try { return JSON.parse(localStorage.getItem('savedSchedules') || '[]'); } catch { return []; }
            });
            const [conflictErrors, setConflictErrors] = useState({ type: null, data: [] });
            const [realTimeConflicts, setRealTimeConflicts] = useState({});
            const [modal, setModal] = useState({ isOpen: false, title: "", message: "", isError: false });
            const [helpModalOpen, setHelpModalOpen] = useState(false);
            const [savedPanelOpen, setSavedPanelOpen] = useState(false);
            const [filterPhase, setFilterPhase] = useState("none");

            const hasActiveFilters = Boolean(
                instructorFilter.trim() || selectedDays.length || selectedInstructors.length
            );

            useEffect(() => {
                if (!hasActiveFilters) {
                    setFilterPhase("none");
                    return;
                }
                setFilterPhase("highlight");
                const highlightTimer = setTimeout(() => setFilterPhase("fade"), 900);
                return () => clearTimeout(highlightTimer);
            }, [instructorFilter, selectedDays, selectedInstructors, hasActiveFilters]);

            useEffect(() => {
                if (filterPhase !== "fade") return;
                const hideTimer = setTimeout(() => setFilterPhase("done"), 450);
                return () => clearTimeout(hideTimer);
            }, [filterPhase]);

            const clearFilters = () => {
                setSelectedDays([]);
                setSelectedInstructors([]);
                setInstructorFilter("");
                setFilterPhase("none");
            };

            useEffect(() => {
                document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
                try { localStorage.setItem('darkMode', darkMode); } catch {}
            }, [darkMode]);

            useEffect(() => {
                try { localStorage.setItem('savedSchedules', JSON.stringify(savedSchedules)); } catch {}
            }, [savedSchedules]);

            const showModal = (title, message, isError = true) => setModal({ isOpen: true, title, message, isError });
            const closeModal = () => setModal({ ...modal, isOpen: false });

            const totalCredits = selectedIds.reduce((sum, id) => {
                const course = courses.find(c => c.id === id);
                return sum + (course ? course.credits : 0);
            }, 0);

            const instructors = useMemo(() => [...new Set(
                courses.flatMap(course => Object.values(course.types).flat().map(section => section.instructor))
                    .filter(name => name && name !== "غير محدد")
            )].sort((a, b) => a.localeCompare(b, 'ar')), [courses]);

            const getWeeklyHours = (schedule) => {
                let total = 0;
                schedule.forEach(sec => {
                    sec.slots.forEach(slot => {
                        if (slot.start && slot.end) {
                            const dur = (timeToMin(slot.end) - timeToMin(slot.start)) / 60;
                            total += dur * slot.days.length;
                        }
                    });
                });
                return total.toFixed(1);
            };

            // ✅ FIX: تحسين الأداء (Debounce) لعدم تعليق الشاشة عند اختيار المواد
            useEffect(() => {
                if (view !== "select") return;
                
                const timerId = setTimeout(() => {
                    const selected = courses.filter(c => selectedIds.includes(c.id));
                    const newConflicts = {};
                    for (let i = 0; i < selected.length; i++) {
                        for (let j = i + 1; j < selected.length; j++) {
                            if (isStrictConflict(selected[i], selected[j], hideClosed)) {
                                if (!newConflicts[selected[i].id]) newConflicts[selected[i].id] = [];
                                if (!newConflicts[selected[j].id]) newConflicts[selected[j].id] = [];
                                newConflicts[selected[i].id].push(selected[j].name);
                                newConflicts[selected[j].id].push(selected[i].name);
                            }
                        }
                    }
                    setRealTimeConflicts(newConflicts);
                }, 300); // تأخير 300 مللي ثانية
                
                return () => clearTimeout(timerId);
            }, [selectedIds, hideClosed, courses, view]);

            const showToast = (text) => {
                setToastText(text);
                setTimeout(() => setToastText(""), 3000);
            };

            const copyToClipboard = (text) => {
                navigator.clipboard.writeText(text).then(() => showToast(text));
            };

            const handleFileUpload = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const html = event.target.result;
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, "text/html");
                        const table = doc.getElementById("myForm:offeredCoursesTable");
                        
                        if (!table) {
                            showModal("ملف غير صالح", "لم يتم العثور على جدول المقررات. تأكد من أنك قمت بحفظ صفحة المقررات المطروحة بشكل صحيح.");
                            return;
                        }

                        const rows = table.querySelectorAll("tbody tr");
                        const extracted = {};

                        rows.forEach(row => {
                            const cells = row.querySelectorAll("td");
                            if (cells.length < 6) return;
                            let texts = Array.from(cells).map(c => c.textContent.trim().replace(/\s+/g, ' '));
                            texts = texts.filter(t => t && t !== "التفاصيل" && t !== "null");

                            let code = "", name = "", secId = "", type = "نظري", credits = 0, status = "غير محدد";

                            const statusItem = texts.find(t => t.includes("مغلق") || t.includes("مفتوح"));
                            if (statusItem) { status = statusItem; texts = texts.filter(t => t !== statusItem); }

                            const typeItem = texts.find(t => ["نظري", "عملي", "سريري", "تدريب", "ميداني", "محاضرة"].some(k => t.includes(k)));
                            if (typeItem) { type = typeItem; texts = texts.filter(t => t !== typeItem); }

                            const secItem = texts.find(t => /^\d{4,6}$/.test(t));
                            if (secItem) { secId = secItem; texts = texts.filter(t => t !== secItem); }

                            const creditItem = texts.find(t => /^\d{1,2}$/.test(t));
                            if (creditItem) { credits = parseInt(creditItem); texts = texts.filter(t => t !== creditItem); }

                            const codeItem = texts.find(t => (t.includes("-") && /\d/.test(t)) || (/\d/.test(t) && /[a-zA-Zأ-ي]/.test(t) && t.length <= 15 && !t.includes(" ")));
                            if (codeItem) { code = codeItem; texts = texts.filter(t => t !== codeItem); }

                            if (texts.length > 0) {
                                name = texts.reduce((a, b) => a.length > b.length ? a : b, "");
                            }
                            if (!code) code = name.split(" ")[0] || ("مجهول-" + secId);
                            if (!name) name = code;
                            if (!secId) secId = "00000";

                            let instructor = "";
                            const instInput = row.querySelector('input[id*="instructor"]');
                            if (instInput && instInput.value.trim()) instructor = instInput.value.trim();
                            else if (cells.length >= 7) instructor = cells[6].textContent.trim();
                            if (!instructor || instructor === "null" || instructor === "التفاصيل" || instructor === "") instructor = "غير محدد";

                            const sectionRaw = row.querySelector('input[id$=":section"]')?.value || "";
                            const slots = parseSectionField(sectionRaw);

                            if (!extracted[code]) extracted[code] = { id: code, name, credits: 0, types: {} };
                            if (credits > extracted[code].credits) extracted[code].credits = credits;
                            if (!extracted[code].types[type]) extracted[code].types[type] = [];
                            extracted[code].types[type].push({ id: secId, courseId: code, courseName: name, type, status, instructor, slots });
                        });

                        setCourses(Object.values(extracted));
                        setView("select");
                    } catch (err) {
                        showModal("خطأ في القراءة", "حدث خطأ غير متوقع أثناء قراءة الملف. يرجى التأكد من اختيار الملف الصحيح.");
                    }
                };
                reader.readAsText(file);
            };

            const toggleSelection = (course) => {
                const isCoop = course.name.includes("التدريب التعاوني");

                if (selectedIds.includes(course.id)) {
                    setSelectedIds(prev => prev.filter(x => x !== course.id));
                } else {
                    if (isSummerTerm && selectedIds.length >= 3) return showModal("الحد الأقصى", "في الترم الصيفي لا يمكنك تجاوز 3 مواد.");
                    if (!isSummerTerm && !isCoop && totalCredits + course.credits > 20) return showModal("تجاوز الساعات", `الحد الأقصى 20 ساعة. المجموع سيصبح ${totalCredits + course.credits}.`);
                    setSelectedIds(prev => [...prev, course.id]);
                }
            };

            const courseColors = useMemo(() => {
                const map = {};
                const currentPalette = PALETTES[colorPalette] || PALETTES['default'];
                courses.forEach((c, i) => { map[c.id] = currentPalette[i % currentPalette.length]; });
                return map;
            }, [courses, colorPalette]);

            const generate = () => {
                const selected = courses.filter(c => selectedIds.includes(c.id));
                setConflictErrors({ type: null, data: [] });

                const hasCoop = selected.some(c => c.name.includes("التدريب التعاوني"));
                if (hasCoop && selected.length === 1) return setView("coop_result");

                const nonCoopCredits = selected.filter(c => !c.name.includes("التدريب التعاوني")).reduce((s, c) => s + c.credits, 0);
                
                // ✅ FIX: تحويل الحد الأدنى للساعات إلى تنبيه بدلاً من المنع التام للطلاب الخريجين
                if (!isSummerTerm && !hasCoop && nonCoopCredits < 12) {
                    alert("تنبيه: مجموع ساعاتك أقل من 12 ساعة (الحد الأدنى للترم العادي). سيتم إنشاء الجدول على أي حال.");
                }

                const requirements = [];
                selected.forEach(course => {
                    Object.keys(course.types).forEach(type => requirements.push({ courseId: course.id, type, sections: course.types[type] }));
                });

                const results = [];
                const HARD_LIMIT = 500; 

                function backtrack(idx, chosen) {
                    if (results.length >= HARD_LIMIT) return;
                    if (idx === requirements.length) { results.push([...chosen]); return; }

                    let availableSections = hideClosed
                        ? requirements[idx].sections.filter(s => isSectionOpen(s.status))
                        : requirements[idx].sections;

                    availableSections = [...availableSections].sort((a, b) => {
                        const aMin = a.slots.length ? timeToMin(a.slots[0].start) : 999;
                        const bMin = b.slots.length ? timeToMin(b.slots[0].start) : 999;
                        return aMin - bMin;
                    });

                    for (const sec of availableSections) {
                        if (!chosen.some(prevSec => prevSec.slots.some(s1 => sec.slots.some(s2 => hasConflict(s1, s2))))) {
                            backtrack(idx + 1, [...chosen, sec]);
                        }
                    }
                }

                backtrack(0, []);

                if (results.length === 0) {
                    const badPairs = [];
                    for (let i = 0; i < selected.length; i++) {
                        for (let j = i + 1; j < selected.length; j++) {
                            if (isStrictConflict(selected[i], selected[j], hideClosed)) {
                                badPairs.push(`${selected[i].name} ⚔️ ${selected[j].name}`);
                            }
                        }
                    }

                    if (badPairs.length > 0) {
                        setConflictErrors({ type: 'pairs', data: badPairs });
                    } else {
                        const culprits = [];
                        for (let i = 0; i < selected.length; i++) {
                            const testSelected = selected.filter((_, idx) => idx !== i);
                            const testReqs = [];
                            testSelected.forEach(course => {
                                Object.keys(course.types).forEach(type => testReqs.push({ courseId: course.id, type, sections: course.types[type] }));
                            });
                            let found = false;
                            function testBacktrack(idx, chosen) {
                                if (found) return;
                                if (idx === testReqs.length) { found = true; return; }
                                let available = hideClosed ? testReqs[idx].sections.filter(s => isSectionOpen(s.status)) : testReqs[idx].sections;
                                for (const sec of available) {
                                    if (!chosen.some(p => p.slots.some(s1 => sec.slots.some(s2 => hasConflict(s1, s2))))) {
                                        testBacktrack(idx + 1, [...chosen, sec]);
                                    }
                                }
                            }
                            testBacktrack(0, []);
                            if (found) culprits.push(selected[i].name);
                        }

                        if (culprits.length > 0) setConflictErrors({ type: 'culprits', data: culprits });
                        else setConflictErrors({ type: 'complex', data: [] });
                    }
                } else {
                    results.sort((a, b) => scoreSchedule(b) - scoreSchedule(a));
                    if (window.confetti) {
                        window.confetti({
                            particleCount: 120,
                            spread: 70,
                            origin: { y: 0.5 },
                            colors: ['#3b82f6', '#8b5cf6', '#10b981', '#fcd34d']
                        });
                    }
                }

                setSchedules(results);
                setCurrentIdx(0);
                setView("result");
            };

            const getFreeDaysCount = (schedule) => {
                const daysUsed = new Set();
                schedule.forEach(sec => sec.slots.forEach(slot => slot.days.forEach(d => daysUsed.add(d))));
                return 5 - daysUsed.size;
            };

            const analyzeSchedule = (schedule) => {
                if (!schedule || schedule.length === 0) return { daysOff: 0, longGaps: 0, heavyDays: 0 };
                
                const daysUsed = new Set();
                const dayClasses = { "SUN": [], "MON": [], "TUE": [], "WED": [], "THU": [] };

                schedule.forEach(sec => {
                    sec.slots.forEach(slot => {
                        if (slot.start && slot.end) {
                            slot.days.forEach(d => {
                                daysUsed.add(d);
                                dayClasses[d].push({ start: timeToMin(slot.start), end: timeToMin(slot.end) });
                            });
                        }
                    });
                });

                const daysOff = 5 - daysUsed.size;
                let longGaps = 0;
                let heavyDays = 0;

                Object.keys(dayClasses).forEach(day => {
                    const classes = dayClasses[day].sort((a, b) => a.start - b.start);
                    
                    if (classes.length >= 4) {
                        heavyDays++;
                    }

                    for (let i = 0; i < classes.length - 1; i++) {
                        const gap = classes[i + 1].start - classes[i].end;
                        if (gap >= 180) { // 3 hours gap (180 mins)
                            longGaps++;
                        }
                    }
                });

                return { daysOff, longGaps, heavyDays };
            };

            const getAllSectionsForCopy = (schedule) => {
                const grouped = {};
                schedule.forEach(sec => {
                    if (!grouped[sec.courseId]) grouped[sec.courseId] = { courseName: sec.courseName, courseId: sec.courseId, sections: [] };
                    grouped[sec.courseId].sections.push(sec);
                });
                return Object.values(grouped);
            };

            const printSchedule = () => {
                window.print();
            };

            const exportScheduleImage = async () => {
                try {
                    const schedule = schedules[currentIdx];
                    if (!schedule) return;
                    const hourHeight = 64, headerHeight = 92, timeWidth = 110, dayWidth = 255;
                    const canvas = document.createElement("canvas");
                    canvas.width = timeWidth + dayWidth * DAYS.length;
                    canvas.height = headerHeight + hourHeight * (GRID_END - GRID_START) + 20;
                    const ctx = canvas.getContext("2d");
                    const background = darkMode ? "#0f172a" : "#ffffff";
                    const textColor = darkMode ? "#f8fafc" : "#1e293b";
                    const lineColor = darkMode ? "#334155" : "#dbe3ee";
                    ctx.fillStyle = background;
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.direction = "rtl";
                    ctx.textAlign = "center";
                    ctx.fillStyle = textColor;
                    ctx.font = "700 25px Arial";
                    ctx.fillText("جدولي الدراسي", canvas.width / 2, 34);
                    ctx.font = "15px Arial";
                    ctx.fillStyle = darkMode ? "#94a3b8" : "#64748b";
                    ctx.fillText(new Date().toLocaleDateString("ar-SA"), canvas.width / 2, 60);
                    ctx.fillStyle = darkMode ? "#1e293b" : "#f8fafc";
                    ctx.fillRect(0, headerHeight, canvas.width, 45);
                    ctx.strokeStyle = lineColor;
                    ctx.lineWidth = 1;
                    for (let col = 0; col <= DAYS.length; col++) {
                        const x = timeWidth + col * dayWidth;
                        ctx.beginPath(); ctx.moveTo(x, headerHeight); ctx.lineTo(x, canvas.height - 20); ctx.stroke();
                    }
                    for (let hour = 0; hour <= GRID_END - GRID_START; hour++) {
                        const y = headerHeight + 45 + hour * hourHeight;
                        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
                    }
                    ctx.fillStyle = textColor;
                    ctx.font = "700 15px Arial";
                    DAYS.forEach((day, index) => ctx.fillText(DAY_LABELS[day], timeWidth + index * dayWidth + dayWidth / 2, headerHeight + 29));
                    ctx.font = "13px Arial";
                    HOURS.forEach((hour, index) => {
                        ctx.fillStyle = darkMode ? "#94a3b8" : "#64748b";
                        ctx.fillText(formatTime(`${String(hour).padStart(2, "0")}:00`, use12hFormat), timeWidth / 2, headerHeight + 66 + index * hourHeight);
                    });
                    schedule.forEach(section => {
                        const color = courseColors[section.courseId] || COLORS[0];
                        section.slots.forEach(slot => slot.days.forEach(day => {
                            const dayIndex = DAYS.indexOf(day);
                            if (dayIndex < 0 || !slot.start || !slot.end) return;
                            const start = timeToMin(slot.start) - GRID_START * 60;
                            const duration = timeToMin(slot.end) - timeToMin(slot.start);
                            if (start < 0 || duration <= 0) return;
                            const x = timeWidth + dayIndex * dayWidth + 8;
                            const y = headerHeight + 45 + (start / 60) * hourHeight + 3;
                            const width = dayWidth - 16;
                            const height = Math.max(34, (duration / 60) * hourHeight - 6);
                            ctx.fillStyle = color.bg;
                            ctx.globalAlpha = 0.16;
                            ctx.fillRect(x, y, width, height);
                            ctx.globalAlpha = 1;
                            ctx.strokeStyle = color.bg;
                            ctx.lineWidth = 2;
                            ctx.strokeRect(x, y, width, height);
                            ctx.fillStyle = textColor;
                            ctx.font = "700 13px Arial";
                            ctx.fillText(section.courseId, x + width / 2, y + 18);
                            ctx.font = "12px Arial";
                            ctx.fillText(`${formatTime(slot.start, use12hFormat)} - ${formatTime(slot.end, use12hFormat)}`, x + width / 2, y + Math.min(height - 8, 35));
                        }));
                    });
                    const link = document.createElement("a");
                    link.download = `جدولي-${new Date().toISOString().slice(0, 10)}.png`;
                    link.href = canvas.toDataURL("image/png");
                    link.click();
                    showToast("تم حفظ صورة الجدول");
                } catch (error) {
                    showModal("تعذّر التصدير", "حدث خطأ أثناء إنشاء الصورة. جرّب مرة أخرى.");
                }
            };

            const saveCurrentSchedule = () => {
                if (!schedules[currentIdx]) return;
                const saved = {
                    id: `${Date.now()}`,
                    name: `جدول محفوظ ${savedSchedules.length + 1}`,
                    sections: schedules[currentIdx],
                    courses,
                    savedAt: new Date().toLocaleDateString('ar-SA'),
                };
                setSavedSchedules(previous => {
                    const next = [...previous, saved];
                    try { localStorage.setItem('savedSchedules', JSON.stringify(next)); }
                    catch { showModal("تعذر الحفظ", "تعذر حفظ الجدول في المتصفح. تأكد من أن التخزين المحلي مسموح."); }
                    return next;
                });
                setSavedPanelOpen(true);
                showToast("تم حفظ الجدول في المحفوظات");
            };

            const shareCurrentSchedule = () => {
                if (!schedules[currentIdx]) return;
                try {
                    const payload = {
                        sections: schedules[currentIdx],
                        courses
                    };
                    const jsonStr = JSON.stringify(payload);
                    const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
                    const shareUrl = `${window.location.origin}${window.location.pathname}#share=${encoded}`;
                    navigator.clipboard.writeText(shareUrl).then(() => {
                        showToast("تم نسخ رابط المشاركة 🔗");
                        showModal("تم نسخ رابط المشاركة 🔗", "تم نسخ رابط تفاصيل الجدول إلى الحافظة بنجاح!\nيمكنك الآن إرساله لزملائك ليفتحوا نفس الجدول فوراً عند ضغط الرابط.", false);
                    });
                } catch (e) {
                    showModal("تعذر المشاركة", "حدث خطأ أثناء إعداد رابط المشاركة.");
                }
            };

            useEffect(() => {
                try {
                    const hash = window.location.hash;
                    if (hash.includes('#share=')) {
                        const raw = hash.split('#share=')[1];
                        const jsonStr = decodeURIComponent(escape(atob(decodeURIComponent(raw))));
                        const data = JSON.parse(jsonStr);
                        if (data && data.sections) {
                            setCourses(data.courses || []);
                            setSelectedIds((data.courses || []).map(course => course.id));
                            setSchedules([data.sections]);
                            setCurrentIdx(0);
                            setView("result");
                            showToast("تم تحميل الجدول المشارَك بنجاح ✨");
                        }
                    }
                } catch (err) {
                    console.warn("Could not load shared schedule:", err);
                }
            }, []);

            const openSavedSchedule = (saved) => {
                setCourses(saved.courses || []);
                setSelectedIds((saved.courses || []).map(course => course.id));
                setSchedules([saved.sections]);
                setCurrentIdx(0);
                setView("result");
                setSavedPanelOpen(false);
            };

            const hasActiveConflicts = Object.keys(realTimeConflicts).length > 0;

            return (
                <div className="app-shell">

                    <button className="theme-toggle-btn no-print" onClick={() => setDarkMode(!darkMode)} title="تبديل الوضع">
                        {darkMode ? '☀️' : '🌙'}
                    </button>

                    <CustomModal isOpen={modal.isOpen} title={modal.title} message={modal.message} isError={modal.isError} onClose={closeModal} />

                    <CustomModal isOpen={helpModalOpen} title="طريقة استخراج الجدول 📋" isError={false} onClose={() => setHelpModalOpen(false)}>
                        <ul className="help-list">
                            <li><b>1.</b> سجل دخولك في بوابة النظام الأكاديمي (أكاديميا).</li>
                            <li><b>2.</b> اذهب إلى قائمة <b>"المقررات المطروحة"</b>.</li>
                            <li><b>3.</b> اختر الكلية والتخصص واضغط <b>"بحث"</b> لتظهر الجداول.</li>
                            <li><b>4.</b> اضغط بزر الفأرة الأيمن في أي مكان بالشاشة، واختر <b>"حفظ كـ" (Save As)</b>.</li>
                            <li><b>5.</b> في خيار "حفظ كنوع"، تأكد من اختيار <b>(Webpage, HTML Only)</b> واحفظ الملف.</li>
                            <li><b>6.</b> ارجع لهذه الأداة وارفع الملف.</li>
                        </ul>
                    </CustomModal>

                    <CustomModal isOpen={savedPanelOpen} title="🔖 الجداول المحفوظة" isError={false} onClose={() => setSavedPanelOpen(false)}>
                        {savedSchedules.length ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {savedSchedules.map(saved => (
                                    <div key={saved.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "10px", background: "var(--hover-bg)", border: "1px solid var(--border-color)", borderRadius: "10px" }}>
                                        <button onClick={() => openSavedSchedule(saved)} style={{ flex: 1, textAlign: "right", border: "none", background: "transparent", color: "var(--text-main)", cursor: "pointer", fontFamily: "IBM Plex Sans Arabic, sans-serif", fontWeight: "bold" }}>{saved.name}<small style={{ display: "block", color: "var(--text-muted)", marginTop: "3px" }}>{saved.savedAt}</small></button>
                                        <button onClick={() => setSavedSchedules(previous => previous.filter(item => item.id !== saved.id))} title="حذف الجدول" style={{ border: "none", background: "var(--danger-bg)", color: "var(--danger-text)", cursor: "pointer", borderRadius: "7px", padding: "6px 9px" }}>حذف</button>
                                    </div>
                                ))}
                            </div>
                        ) : <p style={{ color: "var(--text-muted)", textAlign: "center" }}>لا توجد جداول محفوظة حتى الآن.</p>}
                    </CustomModal>

                    <div className={`copy-toast ${toastText ? 'show' : ''}`}>✅ تم نسخ رقم الشعبة: {toastText}</div>

                    <div className="app-container">

                        {/* Header */}
                        <div className="no-print app-header">
                            <div className="brand">
                                <div className="brand-mark">🗓️</div>
                                <h1>منظم جدول</h1>
                            </div>
                            <p className="brand-subtitle">ابنِ جدولك الدراسي بأقل تعارضات وفي دقائق</p>
                            <div className="progress-steps" aria-label="مراحل إنشاء الجدول">
                                <div className={`progress-step ${view === "upload" ? "active" : ""}`}><span className="progress-number">1</span>رفع الملف</div>
                                <div className={`progress-step ${view === "select" ? "active" : ""}`}><span className="progress-number">2</span>اختيار المواد</div>
                                <div className={`progress-step ${view === "result" || view === "coop_result" ? "active" : ""}`}><span className="progress-number">3</span>الجدول</div>
                            </div>

                            <button className="btn-animate" onClick={() => setSavedPanelOpen(true)} style={{ position: "absolute", left: "20px", top: "15px", background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.45)", color: "white", borderRadius: "10px", padding: "7px 10px", fontSize: "12px", fontWeight: "bold", cursor: "pointer" }}>🔖 المحفوظات {savedSchedules.length ? `(${savedSchedules.length})` : ""}</button>

                            {view === "upload" && (
                                <button className="btn-animate" onClick={() => setHelpModalOpen(true)} style={{
                                    position: 'absolute', right: '20px', top: '15px', background: 'transparent',
                                    border: '2px solid rgba(255,255,255,0.5)', color: 'white', borderRadius: '50%',
                                    width: '32px', height: '32px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer',
                                    display: 'flex', justifyContent: 'center', alignItems: 'center'
                                }}>?</button>
                            )}

                            {view === "select" && (
                                <div className="fade-in-up" style={{ display: "flex", justifyContent: "center", gap: "15px", flexWrap: "wrap", marginTop: "15px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.1)", padding: "5px 15px", borderRadius: "20px" }}>
                                        <span style={{ fontSize: "13px", fontWeight: "bold", color: isSummerTerm ? "#fcd34d" : "white", transition: "0.3s" }}>الترم الصيفي</span>
                                        <label className="switch">
                                            <input type="checkbox" className="summer-toggle" checked={isSummerTerm} onChange={e => { setIsSummerTerm(e.target.checked); setSelectedIds([]); }} />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.1)", padding: "5px 15px", borderRadius: "20px" }}>
                                        <span style={{ fontSize: "13px", fontWeight: "bold", color: "white" }}>إخفاء المغلقة</span>
                                        <label className="switch">
                                            <input type="checkbox" checked={hideClosed} onChange={() => setHideClosed(!hideClosed)} />
                                            <span className="slider"></span>
                                        </label>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="app-content">

                            {view === "upload" && (
                                <div className="fade-in-up upload-zone">
                                    <div style={{ fontSize: "50px", marginBottom: "20px" }}>📄</div>
                                    <h2 style={{ marginBottom: "10px", color: "var(--text-main)" }}>ارفع ملف المقررات (HTML)</h2>
                                    {savedSchedules.length > 0 && (
                                        <div style={{ margin: "22px auto 0", maxWidth: "620px", textAlign: "right", background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "12px" }}>
                                            <div style={{ fontWeight: "bold", marginBottom: "8px", color: "var(--text-main)" }}>🔖 الجداول المحفوظة</div>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                                                {savedSchedules.map(saved => (
                                                    <div key={saved.id} style={{ display: "flex", alignItems: "center", background: "var(--hover-bg)", borderRadius: "8px", overflow: "hidden" }}>
                                                        <button onClick={() => openSavedSchedule(saved)} style={{ border: "none", background: "transparent", color: "var(--text-main)", cursor: "pointer", padding: "8px 10px", fontFamily: "IBM Plex Sans Arabic, sans-serif" }}>{saved.name}</button>
                                                        <button onClick={() => setSavedSchedules(previous => previous.filter(item => item.id !== saved.id))} title="حذف" style={{ border: "none", borderRight: "1px solid var(--border-color)", background: "transparent", color: "var(--danger-text)", cursor: "pointer", padding: "8px 9px" }}>×</button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <input type="file" accept=".html" onChange={handleFileUpload} style={{ display: "none" }} id="fileInput" />
                                    <label htmlFor="fileInput" className="btn-animate" style={{
                                        background: "#3b82f6", color: "white", padding: "12px 35px", borderRadius: "12px",
                                        cursor: "pointer", fontWeight: "bold", fontSize: "16px", display: "inline-block",
                                        boxShadow: "0 4px 10px rgba(59, 130, 246, 0.3)", marginTop: "15px"
                                    }}>اختيار الملف</label>
                                </div>
                            )}

                            {view === "select" && (
                                <div key="select-view">
                                    <div className="fade-in-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
                                        <h3 style={{ margin: 0, color: "var(--text-main)" }}>
                                            اختر المواد ({selectedIds.length})
                                            {isSummerTerm && <span style={{ fontSize: "13px", color: "var(--danger-text)", marginRight: "10px", padding: "4px 10px", background: "var(--danger-bg)", borderRadius: "6px" }}>الحد الأقصى: 3 مواد</span>}
                                        </h3>
                                        <div style={{ display: "flex", gap: "15px", alignItems: "center", flexWrap: "wrap" }}>
                                            {!isSummerTerm && (
                                                <div style={{
                                                    background: totalCredits < 12 ? "var(--warning-bg)" : (totalCredits > 20 ? "var(--danger-bg)" : "var(--success-bg)"),
                                                    color: totalCredits < 12 ? "var(--warning-text)" : (totalCredits > 20 ? "var(--danger-text)" : "var(--success-text)"),
                                                    padding: "10px 15px", borderRadius: "10px", fontWeight: "bold",
                                                    border: `1px solid ${totalCredits < 12 ? "var(--border-color)" : (totalCredits > 20 ? "var(--danger-border)" : "var(--success-border)")}`,
                                                    transition: "0.3s"
                                                }}>
                                                    الساعات: <span style={{ fontSize: "18px" }}>{totalCredits}</span> / 20
                                                </div>
                                            )}
                                            <button className={`btn-animate ${selectedIds.length && !hasActiveConflicts ? 'btn-pulse' : ''}`} onClick={generate}
                                                disabled={selectedIds.length === 0 || hasActiveConflicts}
                                                style={{
                                                    background: selectedIds.length && !hasActiveConflicts ? "#10b981" : "var(--text-muted)",
                                                    color: "white", border: "none", padding: "12px 25px",
                                                    borderRadius: "10px", fontWeight: "bold",
                                                    cursor: selectedIds.length && !hasActiveConflicts ? "pointer" : "not-allowed",
                                                    boxShadow: selectedIds.length && !hasActiveConflicts ? "0 4px 10px rgba(16, 185, 129, 0.3)" : "none"
                                                }}>توليد الجداول ⚡</button>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: "15px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                        <input
                                            className="search-input"
                                            type="text"
                                            placeholder="🔍 بحث باسم المادة أو الكود..."
                                            value={instructorFilter}
                                            onChange={e => setInstructorFilter(e.target.value)}
                                            style={{
                                                flex: 1, padding: "10px 15px", borderRadius: "10px",
                                                border: "1px solid var(--border-color)", background: "var(--hover-bg)",
                                                color: "var(--text-main)", fontSize: "14px", outline: "none",
                                                fontFamily: "IBM Plex Sans Arabic, sans-serif"
                                            }}
                                        />
                                    </div>

                                    <div style={{ marginBottom: "18px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                        <select value="" onChange={e => { const day = e.target.value; if (day && !selectedDays.includes(day)) setSelectedDays(previous => [...previous, day]); }} style={{ minWidth: "155px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "var(--card-bg)", color: "var(--text-main)", fontFamily: "IBM Plex Sans Arabic, sans-serif" }}>
                                            <option value="">+ إضافة يوم</option>
                                            {DAYS.filter(day => !selectedDays.includes(day)).map(day => <option key={day} value={day}>{DAY_LABELS[day]}</option>)}
                                        </select>
                                        <select value="" onChange={e => { const instructor = e.target.value; if (instructor && !selectedInstructors.includes(instructor)) setSelectedInstructors(previous => [...previous, instructor]); }} style={{ flex: 1, minWidth: "190px", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "var(--card-bg)", color: "var(--text-main)", fontFamily: "IBM Plex Sans Arabic, sans-serif" }}>
                                            <option value="">+ إضافة عضو هيئة تدريس</option>
                                            {instructors.filter(instructor => !selectedInstructors.includes(instructor)).map(instructor => <option key={instructor} value={instructor}>{instructor}</option>)}
                                        </select>
                                        {(selectedDays.length || selectedInstructors.length || instructorFilter) && <button className="btn-animate" onClick={clearFilters} style={{ padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--border-color)", background: "var(--hover-bg)", color: "var(--text-main)", cursor: "pointer", fontFamily: "IBM Plex Sans Arabic, sans-serif" }}>مسح الفلاتر</button>}
                                    </div>

                                    {(selectedDays.length > 0 || selectedInstructors.length > 0) && (
                                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", margin: "-8px 0 18px" }}>
                                            {selectedDays.map(day => <span key={day} style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "7px 10px", borderRadius: "999px", background: "#dbeafe", color: "#1e40af", fontWeight: "bold", fontSize: "13px" }}>{DAY_LABELS[day]}<button onClick={() => setSelectedDays(previous => previous.filter(value => value !== day))} aria-label={`إلغاء ${DAY_LABELS[day]}`} style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: 0 }}>×</button></span>)}
                                            {selectedInstructors.map(instructor => <span key={instructor} style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "7px 10px", borderRadius: "999px", background: "#dcfce7", color: "#166534", fontWeight: "bold", fontSize: "13px" }}>{instructor}<button onClick={() => setSelectedInstructors(previous => previous.filter(value => value !== instructor))} aria-label={`إلغاء ${instructor}`} style={{ border: "none", background: "transparent", color: "inherit", cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: 0 }}>×</button></span>)}
                                        </div>
                                    )}

                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "15px" }}>
                                        {courses
                                            .filter(c => filterPhase !== "done" || !hasActiveFilters || courseMatchesFilters(c, instructorFilter, selectedDays, selectedInstructors))
                                            .map((c, idx) => {
                                                const isSelected = selectedIds.includes(c.id);
                                                const allSections = Object.values(c.types).flat();
                                                const openCount = allSections.filter(s => isSectionOpen(s.status)).length;
                                                const closedCount = allSections.filter(s => isSectionClosed(s.status)).length;
                                                const isCoop = c.name.includes("التدريب التعاوني");
                                                const matchesFilter = courseMatchesFilters(c, instructorFilter, selectedDays, selectedInstructors);

                                                let isDisabled = false;
                                                if (hideClosed && openCount === 0 && !isCoop) isDisabled = true;

                                                const courseConflicts = realTimeConflicts[c.id];
                                                const isConflicting = isSelected && courseConflicts && courseConflicts.length > 0;

                                                let borderColor = isSelected ? courseColors[c.id].bg : "var(--border-color)";
                                                let bgColor = isSelected ? (darkMode ? "rgba(0,0,0,0.2)" : courseColors[c.id].light) : (isDisabled ? "var(--hover-bg)" : "var(--card-bg)");
                                                if (isConflicting) { borderColor = "var(--danger-border)"; bgColor = "var(--danger-bg)"; }

                                                const filterClass = hasActiveFilters && matchesFilter && filterPhase !== "none"
                                                    ? " filter-highlight"
                                                    : hasActiveFilters && !matchesFilter && (filterPhase === "highlight" || filterPhase === "fade")
                                                        ? ` filter-dim${filterPhase === "fade" ? " filter-fading" : ""}`
                                                        : "";

                                                return (
                                                    <div key={c.id} className={`stagger-item course-card${filterClass}`} role="button"
                                                        tabIndex={isDisabled ? -1 : 0}
                                                        aria-pressed={isSelected}
                                                        aria-label={`${isSelected ? "إلغاء اختيار" : "اختيار"} ${c.name}`}
                                                        onClick={() => !isDisabled && toggleSelection(c)}
                                                        onKeyDown={e => {
                                                            if (!isDisabled && (e.key === "Enter" || e.key === " ")) {
                                                                e.preventDefault();
                                                                toggleSelection(c);
                                                            }
                                                        }}
                                                        style={{
                                                            padding: "18px", borderRadius: "14px",
                                                            border: `2px solid ${borderColor}`, background: bgColor,
                                                            cursor: isDisabled ? "not-allowed" : "pointer",
                                                            opacity: isDisabled ? 0.5 : 1,
                                                            transition: "opacity 0.45s ease, transform 0.45s ease, box-shadow 0.25s ease, border-color 0.25s ease",
                                                            animationDelay: `${idx * 0.04}s`
                                                        }}>
                                                        <div style={{ fontWeight: "bold", fontSize: "16px", color: isConflicting ? "var(--danger-text)" : "var(--text-main)" }}>{c.id}</div>
                                                        <div style={{ fontSize: "14px", color: isConflicting ? "var(--danger-text)" : "var(--text-muted)", marginTop: "6px" }}>{c.name}</div>
                                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                                                            <div style={{ fontSize: "13px", color: isConflicting ? "var(--danger-text)" : "var(--text-main)", fontWeight: "bold" }}>{c.credits} ساعات</div>
                                                            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "bold", background: "var(--hover-bg)", padding: "2px 6px", borderRadius: "4px" }}>يتطلب: {Object.keys(c.types).join(" + ")}</div>
                                                        </div>
                                                        {!isCoop ? (
                                                            <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                                                                <span style={{ background: "var(--success-bg)", color: "var(--success-text)", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", border: "1px solid var(--success-border)" }}>{openCount} مفتوحة</span>
                                                                <span style={{ background: "var(--danger-bg)", color: "var(--danger-text)", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", fontWeight: "bold", border: "1px solid var(--danger-border)" }}>{closedCount} مغلقة</span>
                                                            </div>
                                                        ) : (
                                                            <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--warning-text)", fontWeight: "bold", background: "var(--warning-bg)", padding: "4px 8px", borderRadius: "6px", display: "inline-block" }}>مقرر ميداني (بدون وقت محدد)</div>
                                                        )}
                                                        {isConflicting && (
                                                            <div className="fade-in-up" style={{ marginTop: "15px", fontSize: "12px", color: "var(--danger-text)", fontWeight: "bold", background: "var(--danger-bg)", padding: "10px", borderRadius: "8px", border: "1px solid var(--danger-border)" }}>
                                                                ⚠️ يتعارض مع: {courseConflicts.join("، ")}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            {view === "coop_result" && (
                                <div className="fade-in-up" style={{ textAlign: "center", padding: "80px", border: "2px dashed #3b82f6", borderRadius: "20px", background: "rgba(59, 130, 246, 0.1)" }}>
                                    <div style={{ fontSize: "60px", marginBottom: "15px" }}>🏢</div>
                                    <h2 style={{ color: "#3b82f6", margin: "0 0 10px 0" }}>مقرر ميداني</h2>
                                    <p style={{ color: "var(--text-muted)", fontSize: "16px" }}>التدريب التعاوني لا يمتلك جدولاً زمنياً. يرجى التواصل مع كليتك / مشرف التدريب للحصول على التفاصيل.</p>
                                    <button className="btn-animate" onClick={() => setView("select")} style={{ marginTop: "20px", background: "#3b82f6", color: "white", border: "none", padding: "12px 25px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold" }}>العودة للمواد</button>
                                </div>
                            )}

                            {view === "result" && (
                                <div key="result-view" className="fade-in-up">
                                    <div className="no-print" style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "20px" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                                            <button className="btn-animate" onClick={() => setView("select")} style={{ background: "var(--card-bg)", color: "var(--text-main)", border: "1px solid var(--border-color)", padding: "10px 18px", borderRadius: "12px", cursor: "pointer", fontWeight: "bold", fontSize: "14px", boxShadow: "var(--shadow)", display: "inline-flex", alignItems: "center", gap: "6px" }}>← تعديل الخيارات</button>
                                            
                                            {schedules.length > 0 && (
                                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                                                    <button className="btn-animate" onClick={saveCurrentSchedule} style={{ background: "var(--card-bg)", color: "var(--text-main)", border: "1px solid var(--border-color)", padding: "10px 16px", borderRadius: "12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", boxShadow: "var(--shadow)" }}>🔖 حفظ</button>
                                                    <button className="btn-animate" onClick={exportScheduleImage} style={{ background: "var(--card-bg)", color: "var(--text-main)", border: "1px solid var(--border-color)", padding: "10px 16px", borderRadius: "12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", boxShadow: "var(--shadow)" }}>🖼️ صورة</button>
                                                    <button className="btn-animate" onClick={shareCurrentSchedule} style={{ background: "#2563eb", color: "#ffffff", border: "none", padding: "10px 18px", borderRadius: "12px", cursor: "pointer", fontWeight: "bold", fontSize: "13px", boxShadow: "0 4px 14px rgba(37,99,235,0.3)" }}>🔗 مشاركة</button>
                                                </div>
                                            )}
                                        </div>

                                        {schedules.length > 0 && (
                                            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--card-bg)", padding: "8px 15px", borderRadius: "12px", border: "1px solid var(--border-color)", boxShadow: "var(--shadow)" }}>
                                                    <span style={{ fontSize: "13px", fontWeight: "bold", color: "var(--text-main)" }}>صيغة 12h</span>
                                                    <label className="switch" style={{ width: "40px", height: "22px" }}>
                                                        <input type="checkbox" className="time-toggle" checked={use12hFormat} onChange={() => setUse12hFormat(!use12hFormat)} />
                                                        <span className="slider" style={{ borderRadius: "20px" }}></span>
                                                    </label>
                                                </div>

                                                <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "var(--card-bg)", padding: "8px 15px", borderRadius: "12px", border: "1px solid var(--border-color)", boxShadow: "var(--shadow)" }}>
                                                    <span style={{ fontSize: "13px", fontWeight: "bold", color: "var(--text-main)" }}>🎨 الألوان</span>
                                                    <select className="palette-select" value={colorPalette} onChange={e => setColorPalette(e.target.value)}>
                                                        <option value="default">أساسي</option>
                                                        <option value="pastel">باستيل هادئ</option>
                                                        <option value="neon">نيون ساطع</option>
                                                    </select>
                                                </div>

                                                <div style={{ background: "var(--card-bg)", padding: "6px 15px", borderRadius: "12px", fontWeight: "bold", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "10px", border: "1px solid var(--border-color)", boxShadow: "var(--shadow)" }}>
                                                    <button className="btn-animate" onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))} disabled={currentIdx === 0}
                                                        style={{ padding: "6px 12px", borderRadius: "8px", border: "none", background: currentIdx === 0 ? "transparent" : "var(--hover-bg)", color: currentIdx === 0 ? "var(--text-muted)" : "var(--text-main)", cursor: currentIdx === 0 ? "not-allowed" : "pointer" }}>السابق</button>
                                                    <span style={{ direction: "rtl" }}>الجدول {currentIdx + 1} من {schedules.length}</span>
                                                    <button className="btn-animate" onClick={() => setCurrentIdx(prev => Math.min(schedules.length - 1, prev + 1))} disabled={currentIdx === schedules.length - 1}
                                                        style={{ padding: "6px 12px", borderRadius: "8px", border: "none", background: currentIdx === schedules.length - 1 ? "transparent" : "var(--hover-bg)", color: currentIdx === schedules.length - 1 ? "var(--text-muted)" : "var(--text-main)", cursor: currentIdx === schedules.length - 1 ? "not-allowed" : "pointer" }}>التالي</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {schedules.length > 0 ? (
                                        <>
                                            {(() => {
                                                const insights = analyzeSchedule(schedules[currentIdx]);
                                                return (
                                                    <div className="smart-insights-box no-print">
                                                        <div className="smart-insights-title">🤖 تحليل الجدول الذكي:</div>
                                                        <div className="smart-badges">
                                                            {insights.daysOff > 0 ? (
                                                                <div className="smart-badge badge-success">🎉 {insights.daysOff} أيام أوف!</div>
                                                            ) : (
                                                                <div className="smart-badge badge-warning">😔 لا يوجد أيام أوف</div>
                                                            )}
                                                            {insights.longGaps > 0 && (
                                                                <div className="smart-badge badge-danger">⚠️ {insights.longGaps} فترات انتظار طويلة (3+ ساعات)</div>
                                                            )}
                                                            {insights.heavyDays > 0 && (
                                                                <div className="smart-badge badge-warning">🔥 {insights.heavyDays} أيام ضغط (4 محاضرات فأكثر)</div>
                                                            )}
                                                            <div className="smart-badge" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                                                                ⏱️ {getWeeklyHours(schedules[currentIdx])} ساعة أسبوعية
                                                            </div>
                                                            <div className="smart-badge" style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-main)' }}>
                                                                📚 {getAllSectionsForCopy(schedules[currentIdx]).length} مواد مختارة
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            <div className="schedule-workspace">
                                            <aside className="schedule-sidebar no-print">
                                                <h3 className="schedule-sidebar-title"><span>المواد والشعب</span><span>{getAllSectionsForCopy(schedules[currentIdx]).length} مواد</span></h3>
                                                {getAllSectionsForCopy(schedules[currentIdx]).map((group, gIdx) => {
                                                    const color = courseColors[group.courseId] || COLORS[0];
                                                    return <div key={group.courseId} className="course-summary-card" style={{
                                                        background: darkMode ? "rgba(0,0,0,0.2)" : color.light,
                                                        border: `1.5px solid ${color.border}`,
                                                        borderRadius: "12px", padding: "12px 16px",
                                                        animation: `popIn 0.3s ${gIdx * 0.05}s both`
                                                    }}>
                                                        <div style={{ fontWeight: "bold", color: darkMode ? color.darkText : color.bg, marginBottom: "8px", fontSize: "14px" }}>
                                                            {group.courseName}
                                                        </div>
                                                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                                            {group.sections.map(sec => {
                                                                const isOpen = isSectionOpen(sec.status);
                                                                return (
                                                                    <div key={sec.id} style={{
                                                                        display: "flex", alignItems: "center", gap: "8px",
                                                                        background: "var(--card-bg)", padding: "6px 12px", borderRadius: "8px",
                                                                        border: `1px solid ${isOpen ? "var(--success-border)" : "var(--danger-border)"}`,
                                                                        boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                                                                    }}>
                                                                        <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "bold" }}>{sec.type}:</span>
                                                                        <span style={{ fontWeight: "bold", fontSize: "14px", color: "var(--text-main)" }}>{sec.id}</span>
                                                                        <span style={{ fontSize: "11px", color: isOpen ? "var(--success-text)" : "var(--danger-text)", fontWeight: "bold" }}>
                                                                            {isOpen ? "✅ مفتوحة" : "🔒 مغلقة"}
                                                                        </span>
                                                                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>| 👨‍🏫 {sec.instructor}</span>
                                                                        <button className="btn-animate" onClick={() => copyToClipboard(sec.id)} title="نسخ رقم الشعبة"
                                                                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", padding: "0" }}>📋</button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>;
                                                })}
                                            </aside>

                                            <main className="schedule-main">
                                                <div className="schedule-grid-frame">
                                                    <TimeGrid sections={schedules[currentIdx]} courseColors={courseColors} use12h={use12hFormat} darkMode={darkMode} />
                                                </div>
                                            </main>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="fade-in-up" style={{ textAlign: "center", padding: "60px", border: "3px dashed var(--danger-border)", borderRadius: "20px", background: "var(--danger-bg)" }}>
                                            <div style={{ fontSize: "60px", marginBottom: "15px" }}>⚠️</div>
                                            <h2 style={{ color: "var(--danger-text)", margin: "0 0 15px 0" }}>تعارض حتمي في الجدول!</h2>

                                            {conflictErrors.type === 'pairs' && (
                                                <div style={{ marginTop: "20px", textAlign: "right", background: "var(--card-bg)", padding: "25px", borderRadius: "12px", border: "1px solid var(--danger-border)" }}>
                                                    <h3 style={{ color: "var(--danger-text)", marginTop: 0 }}>🔍 المكتشف الآلي للتعارض:</h3>
                                                    <p style={{ color: "var(--text-main)", fontSize: "15px", marginBottom: "15px" }}>يرجى الاستغناء عن إحدى المادتين المتعارضتين:</p>
                                                    <ul style={{ color: "var(--danger-text)", fontWeight: "bold", paddingRight: "0", margin: 0, listStyleType: "none" }}>
                                                        {conflictErrors.data.map((err, i) => (
                                                            <li key={i} style={{ background: "var(--danger-bg)", padding: "10px 15px", borderRadius: "8px", marginBottom: "8px", border: "1px solid var(--danger-border)", display: "flex", alignItems: "center", gap: "10px" }}>
                                                                <span>⚔️</span> {err.replace("⚔️", "-")}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {conflictErrors.type === 'culprits' && (
                                                <div style={{ marginTop: "20px", textAlign: "right", background: "var(--card-bg)", padding: "25px", borderRadius: "12px", border: "1px solid var(--danger-border)" }}>
                                                    <h3 style={{ color: "var(--danger-text)", marginTop: 0 }}>💡 الحل الذكي:</h3>
                                                    <p style={{ color: "var(--text-main)", fontSize: "15px", marginBottom: "15px" }}>الجدول سيعمل بنجاح بحذف <b>مادة واحدة فقط</b> من:</p>
                                                    <ul style={{ color: "var(--danger-text)", fontWeight: "bold", paddingRight: "0", margin: 0, listStyleType: "none", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                                                        {conflictErrors.data.map((err, i) => (
                                                            <li key={i} style={{ background: "var(--danger-bg)", padding: "10px 15px", borderRadius: "8px", border: "1px solid var(--danger-border)" }}>
                                                                🗑️ {err}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {conflictErrors.type === 'complex' && (
                                                <div style={{ marginTop: "20px", textAlign: "right", background: "var(--card-bg)", padding: "25px", borderRadius: "12px", border: "1px solid var(--danger-border)" }}>
                                                    <h3 style={{ color: "var(--danger-text)", marginTop: 0 }}>تعارض معقد جداً:</h3>
                                                    <p style={{ color: "var(--text-main)", fontSize: "15px", margin: 0, lineHeight: "1.7" }}>
                                                        يوجد تداخل شديد بين المواد، أو لا توجد شعب متاحة.<br /><br />
                                                        <strong>الحل:</strong> قم بإزالة أكثر من مادة، أو أوقف خيار "إخفاء المغلقة".
                                                    </p>
                                                </div>
                                            )}

                                            <button className="btn-animate" onClick={() => setView("select")} style={{ marginTop: "30px", background: "#ef4444", color: "white", border: "none", padding: "12px 30px", borderRadius: "10px", cursor: "pointer", fontWeight: "bold", fontSize: "16px" }}>العودة لتعديل المواد</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        <footer className="footer">
                            تطوير وهندسة الأوامر: <span>عبدالعزيز مشنوي</span> | مدعوم بالذكاء الاصطناعي
                        </footer>
                    </div>
                </div>
            );
        }

        const root = ReactDOM.createRoot(document.getElementById("root"));
        root.render(<App />);
    
