"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuthRedirect } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { 
  ArrowUpRight, 
  Moon, 
  Timer, 
  Target, 
  Flame, 
  TrendingUp, 
  Calendar,
  BarChart3,
  Loader2,
  AlertCircle
} from "lucide-react";
import { api } from "@/lib/api-client";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface ReportData {
  sleepData: Array<{ date: string; hours: number }>;
  studyData: Array<{ date: string; minutes: number }>;
  taskCompletion: Array<{ date: string; completed: number; total: number }>;
  goalProgress: Array<{ category: string; current: number; target: number; percentage: number }>;
  streakInfo: { currentStreak: number; bestStreak: number; totalDays: number };
  weeklyComparison: {
    thisWeek: { sleep: number; study: number; tasks: number };
    lastWeek: { sleep: number; study: number; tasks: number };
  };
}

const COLORS = ['#71d4ff', '#b69cff', '#ffb86b', '#6bffb8', '#ff9f6b'];

export default function RelatorioPage() {
  const { user, loading } = useAuthRedirect({ ifGuest: "/" });
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [error, setError] = useState("");
  const [timeRange, setTimeRange] = useState<"week" | "month">("week");

  useEffect(() => {
    if (!user || loading) return;
    fetchReportData();
  }, [user, loading, timeRange]);

  async function fetchReportData() {
    if (!user) return;
    setLoadingPage(true);
    try {
      const token = await user.getIdToken();
      const days = timeRange === "week" ? 7 : 30;
      
      // Fetch report data from new API endpoint
      const reportRes = await fetch(`/api/relatorio?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!reportRes.ok) {
        throw new Error("Não foi possível carregar o relatório.");
      }
      
      const reportApiData = await reportRes.json();
      
      // Fetch goals data for progress
      const goalsRes = await fetch("/api/goals", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const goalsData = await goalsRes.json();
      
      // Process and transform data
      const processedData = processReportData(reportApiData, goalsData || [], days);
      setReportData(processedData);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o relatório.");
    } finally {
      setLoadingPage(false);
    }
  }

  function processReportData(apiData: any, goals: any[], days: number): ReportData {
    // Process sleep data from checkins
    const sleepData = apiData.checkins.map((c: any) => ({
      date: formatDate(c.checkinDate),
      hours: c.sleepHours || 0
    }));

    // Process study data from checkins
    const studyData = apiData.checkins.map((c: any) => ({
      date: formatDate(c.checkinDate),
      minutes: c.studyMinutes || 0
    }));

    // Process task completion data
    const taskCompletion = apiData.completions.map((c: any) => ({
      date: formatDate(c.date),
      completed: c.completed,
      total: c.total
    }));

    // Process goal progress
    const goalProgress = goals.map((g: any) => ({
      category: g.goal.category,
      current: g.goal.currentValue,
      target: g.goal.targetValue,
      percentage: Math.round((g.goal.currentValue / g.goal.targetValue) * 100)
    }));

    // Use actual streak info from API
    const streakInfo = apiData.streakInfo;

    // Use actual weekly comparison from API
    const weeklyComparison = apiData.weeklyComparison;

    return {
      sleepData,
      studyData,
      taskCompletion,
      goalProgress,
      streakInfo,
      weeklyComparison
    };
  }

  function getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  function getDaysAgo(days: number): string {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date.toISOString().split('T')[0];
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  if (loading || !user || loadingPage) {
    return (
      <AppShell>
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 size={28} className="animate-spin text-[#71d4ff]" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="min-h-screen px-5 py-7 sm:px-8 lg:px-12 lg:py-10">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <p className="mb-2 text-xs uppercase tracking-[.2em] text-[#71d4ff]">RELATÓRIO</p>
            <h1 className="font-display text-3xl tracking-[-.04em] sm:text-4xl">
              Seu progresso<span className="text-[#ffb86b]">.</span>
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setTimeRange("week")}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                timeRange === "week" 
                  ? "bg-[#71d4ff] text-[var(--bg-primary)]" 
                  : "bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-active)]"
              }`}
            >
              7 dias
            </button>
            <button
              onClick={() => setTimeRange("month")}
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                timeRange === "month" 
                  ? "bg-[#71d4ff] text-[var(--bg-primary)]" 
                  : "bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-active)]"
              }`}
            >
              30 dias
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {reportData && (
          <div className="space-y-8">
            {/* Streak Overview */}
            <section className="grid gap-4 md:grid-cols-3">
              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="panel p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-orange-500/20 text-orange-400">
                    <Flame size={20} />
                  </div>
                  <span className="text-sm text-[var(--text-secondary)]">Streak Atual</span>
                </div>
                <div className="font-display text-4xl text-orange-400">{reportData.streakInfo.currentStreak}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">dias consecutivos</div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="panel p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-[#71d4ff]/20 text-[#71d4ff]">
                    <Flame size={20} />
                  </div>
                  <span className="text-sm text-[var(--text-secondary)]">Melhor Streak</span>
                </div>
                <div className="font-display text-4xl text-[#71d4ff]">{reportData.streakInfo.bestStreak}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">recorde pessoal</div>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="panel p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-[#6bffb8]/20 text-[#6bffb8]">
                    <Calendar size={20} />
                  </div>
                  <span className="text-sm text-[var(--text-secondary)]">Total de Dias</span>
                </div>
                <div className="font-display text-4xl text-[#6bffb8]">{reportData.streakInfo.totalDays}</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">dias ativos</div>
              </motion.div>
            </section>

            {/* Sleep Analysis */}
            <section className="panel p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#71d4ff]/20 text-[#71d4ff]">
                    <Moon size={18} />
                  </div>
                  <div>
                    <h2 className="font-display text-xl">Análise de Sono</h2>
                    <p className="text-xs text-[var(--text-muted)]">Horas de sono por dia</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-display text-[#71d4ff]">
                    {reportData.weeklyComparison.thisWeek.sleep.toFixed(1)}h
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    média esta semana
                  </div>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reportData.sleepData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="date" 
                      stroke="rgba(255,255,255,0.4)"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.4)"
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-primary)', 
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px'
                      }}
                      itemStyle={{ color: 'var(--text)' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="hours" 
                      stroke="#71d4ff" 
                      strokeWidth={2}
                      dot={{ fill: '#71d4ff', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Study Time */}
            <section className="panel p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#b69cff]/20 text-[#b69cff]">
                    <Timer size={18} />
                  </div>
                  <div>
                    <h2 className="font-display text-xl">Tempo de Estudo</h2>
                    <p className="text-xs text-[var(--text-muted)]">Minutos por dia</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-display text-[#b69cff]">
                    {Math.round(reportData.weeklyComparison.thisWeek.study)}min
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    média esta semana
                  </div>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.studyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="date" 
                      stroke="rgba(255,255,255,0.4)"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.4)"
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-primary)', 
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px'
                      }}
                      itemStyle={{ color: 'var(--text)' }}
                    />
                    <Bar 
                      dataKey="minutes" 
                      fill="#b69cff"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Task Completion */}
            <section className="panel p-6 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#ffb86b]/20 text-[#ffb86b]">
                    <BarChart3 size={18} />
                  </div>
                  <div>
                    <h2 className="font-display text-xl">Conclusão de Tarefas</h2>
                    <p className="text-xs text-[var(--text-muted)]">Taxa de conclusão diária</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-display text-[#ffb86b]">
                    {reportData.weeklyComparison.thisWeek.tasks}%
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    taxa esta semana
                  </div>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.taskCompletion}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                    <XAxis 
                      dataKey="date" 
                      stroke="rgba(255,255,255,0.4)"
                      fontSize={12}
                    />
                    <YAxis 
                      stroke="rgba(255,255,255,0.4)"
                      fontSize={12}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-primary)', 
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px'
                      }}
                      itemStyle={{ color: 'var(--text)' }}
                    />
                    <Bar 
                      dataKey="completed" 
                      fill="#ffb86b"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Goal Progress */}
            <section className="panel p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-[#6bffb8]/20 text-[#6bffb8]">
                  <Target size={18} />
                </div>
                <div>
                  <h2 className="font-display text-xl">Progresso das Metas</h2>
                  <p className="text-xs text-[var(--text-muted)]">Por categoria</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {reportData.goalProgress.map((goal, index) => (
                  <motion.div
                    key={goal.category}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-[var(--bg-surface-hover)] rounded-lg p-4"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium capitalize">{goal.category}</span>
                      <span className="text-sm font-mono" style={{ color: COLORS[index % COLORS.length] }}>
                        {goal.percentage}%
                      </span>
                    </div>
                    <div className="h-2 bg-[var(--bg-surface-active)] rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${goal.percentage}%`,
                          backgroundColor: COLORS[index % COLORS.length]
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-[var(--text-muted)]">
                      <span>{goal.current} alcançado</span>
                      <span>meta: {goal.target}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Weekly Comparison */}
            <section className="panel p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-[#ff9f6b]/20 text-[#ff9f6b]">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h2 className="font-display text-xl">Comparativo Semanal</h2>
                  <p className="text-xs text-[var(--text-muted)]">Esta semana vs semana anterior</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <ComparisonCard
                  label="Sono"
                  icon={<Moon size={16} />}
                  current={reportData.weeklyComparison.thisWeek.sleep}
                  previous={reportData.weeklyComparison.lastWeek.sleep}
                  unit="h"
                  color="#71d4ff"
                />
                <ComparisonCard
                  label="Estudo"
                  icon={<Timer size={16} />}
                  current={reportData.weeklyComparison.thisWeek.study}
                  previous={reportData.weeklyComparison.lastWeek.study}
                  unit="min"
                  color="#b69cff"
                />
                <ComparisonCard
                  label="Tarefas"
                  icon={<BarChart3 size={16} />}
                  current={reportData.weeklyComparison.thisWeek.tasks}
                  previous={reportData.weeklyComparison.lastWeek.tasks}
                  unit="%"
                  color="#ffb86b"
                />
              </div>
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function ComparisonCard({ 
  label, 
  icon, 
  current, 
  previous, 
  unit, 
  color 
}: { 
  label: string; 
  icon: React.ReactNode; 
  current: number; 
  previous: number; 
  unit: string; 
  color: string; 
}) {
  const change = current - previous;
  const percentChange = previous > 0 ? ((change / previous) * 100).toFixed(1) : '0';
  const isPositive = change >= 0;

  return (
    <div className="bg-[var(--bg-surface-hover)] rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <div style={{ color }}>{icon}</div>
        <span className="text-sm text-white/60">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-display" style={{ color }}>
            {current.toFixed(1)}{unit}
          </div>
          <div className="text-xs text-[var(--text-muted)]">esta semana</div>
        </div>
        <div className={`text-right ${isPositive ? 'text-[#6bffb8]' : 'text-red-400'}`}>
          <div className="text-sm font-medium">
            {isPositive ? '+' : ''}{percentChange}%
          </div>
          <div className="text-xs text-[var(--text-muted)]">vs. anterior</div>
        </div>
      </div>
    </div>
  );
}