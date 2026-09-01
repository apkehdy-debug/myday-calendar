import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Command,
  GripVertical,
  ListTodo,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  X,
} from 'lucide-react';
import {
  getGetCalendarQueryKey,
  getGetDayQueryKey,
  getGetDayQueryOptions,
  useCreateTag,
  useCreateEvent,
  useCreateTask,
  useDeleteTag,
  useDeleteEvent,
  useDeleteTask,
  useGetCalendar,
  useGetDay,
  useGetTags,
  useReorderTasks,
  useScheduleTask,
  useUpdateTag,
  useUpdateEvent,
  useUpdateTask,
} from '@workspace/api-client-react';
import type { CalendarDay, Event, Tag, Task } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();

const pad = (n: number) => String(n).padStart(2, '0');
const isoDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const today = isoDate(new Date());
const monthKey = (date: string) => date.slice(0, 7);
const readableDay = (date: string, format: 'long' | 'short' = 'long') =>
  new Intl.DateTimeFormat('en-US', { weekday: format === 'long' ? 'long' : 'short', month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
const monthTitle = (month: string) => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(`${month}-01T12:00:00`));
const displayTime = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${pad(m)} ${suffix}`;
};
const shiftMonth = (month: string, amount: number) => {
  const date = new Date(`${month}-01T12:00:00`);
  date.setMonth(date.getMonth() + amount);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
};
const classNames = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');
const dueDateLabel = (date: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`));
const isOverdueTask = (task: Task) => Boolean(task.dueDate && !task.completed && task.dueDate < today);

type AppRoute =
  | { kind: 'calendar' }
  | { kind: 'day'; date: string };

type NavigationContextValue = {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

function useNavigation() {
  const navigation = useContext(NavigationContext);
  if (!navigation) throw new Error('Navigation context is unavailable');
  return navigation;
}

function AppShell({ children }: { children: ReactNode }) {
  const { route, navigate } = useNavigation();
  const isDayView = route.kind === 'day';
  const activeDate = isDayView ? route.date : today;
  const [railOpen, setRailOpen] = useState(true);
  const [utilityOpen, setUtilityOpen] = useState<'search' | 'settings' | null>(null);
  const goToday = () => navigate({ kind: 'day', date: today });
  return (
    <div className="myday-app">
      <aside className={classNames('hidden border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] md:flex md:w-[54px] md:flex-col md:items-center md:py-3', railOpen && 'md:w-[58px]')}>
        <div className="mb-7 flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[hsl(var(--primary)/.5)] bg-[hsl(var(--primary)/.11)] text-[hsl(var(--primary))]">
          <Sparkles size={15} strokeWidth={1.7} />
        </div>
        <button data-testid="button-toggle-sidebar" onClick={() => setRailOpen(!railOpen)} className="icon-btn mb-3"><PanelLeft size={15} /></button>
        <button type="button" onClick={() => navigate({ kind: 'calendar' })} data-testid="link-calendar" className={classNames('icon-btn mb-1', !isDayView && 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]')}><CalendarDays size={16} /></button>
        <button type="button" onClick={() => navigate({ kind: 'day', date: activeDate })} data-testid="link-day" className={classNames('icon-btn mb-1', isDayView && 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]')}><ListTodo size={16} /></button>
        <div className="mt-auto flex flex-col gap-1">
          <button data-testid="button-search" onClick={() => setUtilityOpen('search')} className="icon-btn"><Search size={15} /></button>
          <button data-testid="button-settings" onClick={() => setUtilityOpen('settings')} className="icon-btn"><MoreHorizontal size={16} /></button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[46px] shrink-0 items-center border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 md:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-[12px] font-semibold tracking-[.01em] text-[hsl(var(--foreground))]">MyDay</span>
            <span className="hidden text-[11px] text-[hsl(var(--muted-foreground))] sm:inline">/</span>
            <span data-testid="text-current-context" className="hidden truncate text-[11px] text-[hsl(var(--muted-foreground))] sm:inline">{isDayView ? readableDay(activeDate, 'short') : 'Calendar'}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button data-testid="button-command-menu" onClick={() => setUtilityOpen('search')} className="hidden items-center gap-2 rounded-[var(--radius-sm)] border border-[hsl(var(--border))] px-2 py-1 text-[10px] text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--secondary))] sm:flex"><Command size={12} /> Quick find <span className="mono opacity-60">⌘K</span></button>
            <button data-testid="button-jump-today" onClick={goToday} className="ghost-btn h-[28px] min-h-0 px-2.5 text-[11px]">Today</button>
          </div>
        </header>
        <main className="relative min-h-0 flex-1">{children}{utilityOpen && <UtilityPanel mode={utilityOpen} onClose={() => setUtilityOpen(null)} onNavigate={navigate} />}</main>
      </div>
    </div>
  );
}

const tagPalette: Tag['color'][] = ['#d7d7d2', '#b7b8b4', '#979895', '#777875', '#5b5c59', '#3f403d'];
const tagDisplayColor = (tag: Tag) => {
  const hash = [...tag.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return tagPalette[hash % tagPalette.length];
};
const refreshTagViews = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['/api/tags'] });
  queryClient.invalidateQueries({ queryKey: ['/api/calendar'] });
  queryClient.invalidateQueries({ queryKey: ['/api/days'] });
};

function TagPills({ tagIds, tags }: { tagIds?: string[]; tags: Tag[] }) {
  const selected = (tagIds ?? []).map((id) => tags.find((tag) => tag.id === id)).filter((tag): tag is Tag => Boolean(tag));
  if (!selected.length) return null;
  return <span className="flex min-w-0 items-center gap-1 overflow-hidden" aria-label={selected.map((tag) => tag.name).join(', ')}>
    {selected.map((tag) => <span key={tag.id} title={tag.name} className="tag-pill"><i style={{ backgroundColor: tagDisplayColor(tag) }} />{tag.name}</span>)}
  </span>;
}

function TagPicker({ tags, selectedIds, onChange, testId = 'button-tag-picker' }: { tags: Tag[]; selectedIds: string[]; onChange: (tagIds: string[]) => void; testId?: string }) {
  const [open, setOpen] = useState(false);
  const selected = tags.filter((tag) => selectedIds.includes(tag.id));
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((tagId) => tagId !== id) : [...selectedIds, id]);
  return <div className="relative shrink-0">
    <button type="button" data-testid={testId} onClick={() => setOpen((value) => !value)} className={classNames('tag-picker-trigger', selected.length > 0 && 'text-[hsl(var(--foreground)/.85)]')} title="Edit tags">
      <TagIcon size={12} />{selected.length ? <span className="flex max-w-[92px] items-center gap-1 overflow-hidden"><TagPills tagIds={selectedIds} tags={tags} /></span> : <span>Tags</span>}
    </button>
    {open && <div className="absolute left-0 top-[calc(100%+6px)] z-[60] min-w-[190px] rounded-[var(--radius-sm)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1.5 shadow-xl animate-appear">
      <div className="px-2 py-1 text-[9px] uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Assign tags</div>
      {tags.length ? tags.map((tag) => <button key={tag.id} type="button" data-testid={`option-tag-${tag.id}`} onClick={() => toggle(tag.id)} className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-[hsl(var(--secondary))]">
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] border border-[hsl(var(--border))]" style={selectedIds.includes(tag.id) ? { backgroundColor: tagDisplayColor(tag), borderColor: tagDisplayColor(tag) } : undefined}>{selectedIds.includes(tag.id) && <Check size={10} className="text-[hsl(var(--card))]" />}</span><span className="h-2 w-2 rounded-full" style={{ backgroundColor: tagDisplayColor(tag) }} /><span className="truncate">{tag.name}</span>
      </button>) : <div className="px-2 py-2 text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">Create tags from Settings first.</div>}
      <button type="button" onClick={() => setOpen(false)} className="mt-1 w-full border-t border-[hsl(var(--border))] px-2 pt-1.5 text-left text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">Done</button>
    </div>}
  </div>;
}

function TagManager() {
  const { data: tags = [], isLoading } = useGetTags();
  const create = useCreateTag();
  const update = useUpdateTag();
  const remove = useDeleteTag();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [color, setColor] = useState<Tag['color']>(tagPalette[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState<Tag['color']>(tagPalette[0]);
  const [error, setError] = useState('');
  const refresh = () => { refreshTagViews(queryClient); setError(''); };
  const addTag = () => {
    if (!name.trim()) return;
    create.mutate({ data: { name: name.trim(), color } }, { onSuccess: () => { setName(''); refresh(); }, onError: () => setError('Could not create that tag. It may already exist.') });
  };
  const startEditing = (tag: Tag) => { setEditingId(tag.id); setEditingName(tag.name); setEditingColor(tag.color); setError(''); };
  const saveEdit = () => {
    if (!editingId || !editingName.trim()) return;
    update.mutate({ id: editingId, data: { name: editingName.trim(), color: editingColor } }, { onSuccess: () => { setEditingId(null); refresh(); }, onError: () => setError('Could not save that tag. The name may already exist.') });
  };
  const deleteTag = (tag: Tag) => {
    if (!window.confirm(`Delete “${tag.name}”? It will be removed from all tasks and events.`)) return;
    remove.mutate({ id: tag.id }, { onSuccess: refresh, onError: () => setError('Could not delete that tag.') });
  };
  return <div className="space-y-4 pt-3">
    <div><div className="mb-1 text-[12px] font-semibold text-[hsl(var(--foreground))]">Shared tags</div><p className="text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">Use muted labels to keep related tasks and events scannable.</p></div>
    <div className="space-y-2">
      <div className="flex gap-2"><input data-testid="input-new-tag" className="field h-[31px] min-w-0 flex-1 text-[11px]" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} placeholder="New tag name" /><button data-testid="button-create-tag" onClick={addTag} disabled={!name.trim() || create.isPending} className="primary-btn h-[31px] px-2.5 text-[10px]"><Plus size={12} /> Add</button></div>
      <div className="flex items-center gap-2"><span className="text-[10px] text-[hsl(var(--muted-foreground))]">Color</span>{tagPalette.map((item) => <button key={item} type="button" data-testid={`button-new-tag-color-${item.slice(1)}`} onClick={() => setColor(item)} className={classNames('h-4 w-4 rounded-full border-2 transition-transform', color === item ? 'scale-110 border-[hsl(var(--foreground))]' : 'border-transparent')} style={{ backgroundColor: item }} />)}</div>
    </div>
    {error && <p className="text-[10px] text-[hsl(var(--destructive))]">{error}</p>}
    <div className="space-y-1 border-t border-[hsl(var(--border))] pt-2">
      {isLoading ? <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Loading tags…</p> : tags.length ? tags.map((tag) => editingId === tag.id ? <div key={tag.id} className="space-y-2 rounded-[var(--radius-sm)] border border-[hsl(var(--border))] p-2"><input data-testid={`input-edit-tag-${tag.id}`} className="field h-[28px] text-[11px]" value={editingName} onChange={(e) => setEditingName(e.target.value)} /><div className="flex items-center gap-1.5">{tagPalette.map((item) => <button key={item} type="button" onClick={() => setEditingColor(item)} className={classNames('h-4 w-4 rounded-full border-2', editingColor === item ? 'border-[hsl(var(--foreground))]' : 'border-transparent')} style={{ backgroundColor: item }} />)}<button type="button" onClick={saveEdit} className="ml-auto text-[10px] text-[hsl(var(--primary))]">Save</button><button type="button" onClick={() => setEditingId(null)} className="text-[10px] text-[hsl(var(--muted-foreground))]">Cancel</button></div></div> : <div key={tag.id} className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 hover:bg-[hsl(var(--secondary)/.5)]"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tagDisplayColor(tag) }} /><span className="min-w-0 flex-1 truncate text-[11px]">{tag.name}</span><button type="button" data-testid={`button-edit-tag-${tag.id}`} onClick={() => startEditing(tag)} className="icon-btn h-6 w-6 opacity-60 hover:opacity-100"><Pencil size={11} /></button><button type="button" data-testid={`button-delete-tag-${tag.id}`} onClick={() => deleteTag(tag)} className="icon-btn h-6 w-6 opacity-60 hover:text-[hsl(var(--destructive))] hover:opacity-100"><Trash2 size={11} /></button></div>) : <p className="py-2 text-[10px] text-[hsl(var(--muted-foreground))]">No tags yet.</p>}
    </div>
  </div>;
}

function UtilityPanel({ mode, onClose, onNavigate }: { mode: 'search' | 'settings'; onClose: () => void; onNavigate: (route: AppRoute) => void }) {
  const [query, setQuery] = useState('');
  const jump = () => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(query)) { onNavigate({ kind: 'day', date: query }); onClose(); }
  };
  return <div className="absolute right-3 top-3 z-40 w-[min(330px,calc(100vw-24px))] rounded-[var(--radius-md)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 shadow-2xl animate-appear">
    <div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-2"><span className="section-label">{mode === 'search' ? 'Quick find' : 'Settings'}</span><button data-testid="button-close-utility-panel" onClick={onClose} className="icon-btn h-6 w-6"><X size={13} /></button></div>
    {mode === 'search' ? <div className="pt-3"><input data-testid="input-quick-find" autoFocus className="field" placeholder="Type a date: 2025-04-18" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && jump()} /><p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">Press Enter to open a day. Use YYYY-MM-DD.</p>{query && !/^\d{4}-\d{2}-\d{2}$/.test(query) && <p className="mt-2 text-[10px] text-[hsl(var(--destructive))]">That date needs the full year, month, and day.</p>}</div> : <TagManager />}
  </div>;
}

function LoadingState({ label = 'Opening your day' }: { label?: string }) {
  return <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden p-5"><div className="h-5 w-36 animate-pulse rounded-sm bg-[hsl(var(--secondary))]" /><div className="h-3 w-52 animate-pulse rounded-sm bg-[hsl(var(--secondary))]" /><div className="mt-8 text-[11px] text-[hsl(var(--muted-foreground))]">{label}…</div></div>;
}

function ErrorState({ retry }: { retry: () => void }) {
  return <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 overflow-hidden p-6 text-center"><div className="flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--destructive)/.4)] text-[hsl(var(--destructive))]"><RotateCcw size={15} /></div><p className="text-sm text-[hsl(var(--foreground))]">Couldn’t open this view.</p><p className="text-xs text-[hsl(var(--muted-foreground))]">Your plans are safe. Try again in a moment.</p><button data-testid="button-retry" onClick={retry} className="ghost-btn">Try again</button></div>;
}

function CalendarHome() {
  const { navigate } = useNavigation();
  const [month, setMonth] = useState(monthKey(today));
  const [dueDialogDate, setDueDialogDate] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useGetCalendar({ month });
  const { data: tags = [] } = useGetTags();
  const calendarByDate = useMemo(() => new Map((data ?? []).map((day: CalendarDay) => [day.date, day])), [data]);
  const firstDay = new Date(`${month}-01T12:00:00`);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((startOffset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - startOffset + 1;
    return day > 0 && day <= daysInMonth ? `${month}-${pad(day)}` : null;
  });
  const completed = (data ?? []).reduce((sum, item) => sum + item.completedTaskCount, 0);
  const totalTasks = (data ?? []).reduce((sum, item) => sum + item.taskCount, 0);

  return <div className="h-full min-h-0 overflow-hidden">
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1220px] flex-col p-3 sm:p-5 lg:p-7">
      <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-3 animate-appear sm:mb-5">
        <div>
          <div className="section-label mb-2">Your month</div>
          <h1 data-testid="text-month-title" className="text-[25px] font-semibold tracking-[-.03em] text-[hsl(var(--foreground))]">{monthTitle(month)}</h1>
          <p className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">{completed} of {totalTasks || 0} tasks complete · one day at a time</p>
        </div>
         <div className="flex items-center gap-1">
           <button data-testid="button-add-due-task-from-calendar" onClick={() => setDueDialogDate(month === monthKey(today) ? today : `${month}-01`)} className="ghost-btn mr-2 min-h-[27px] px-2 text-[11px]"><CalendarClock size={13} /> Due task</button>
          <button data-testid="button-previous-month" onClick={() => setMonth(shiftMonth(month, -1))} className="icon-btn"><ChevronLeft size={16} /></button>
          <button data-testid="button-next-month" onClick={() => setMonth(shiftMonth(month, 1))} className="icon-btn"><ChevronRight size={16} /></button>
          <button data-testid="button-month-today" onClick={() => setMonth(monthKey(today))} className="ghost-btn ml-2">This month</button>
        </div>
      </div>
      {isLoading ? <LoadingState label="Counting the days" /> : isError ? <ErrorState retry={refetch} /> : <div className="animate-appear">
        <div className="month-grid min-h-0 flex-1 grid-cols-7 border-l border-t border-[hsl(var(--border))]" style={{ gridTemplateRows: `auto repeat(${cells.length / 7}, minmax(0, 1fr))` }}>
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => <div key={label} className="border-b border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] px-2 py-1.5 text-[10px] uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))] sm:px-3">{label}</div>)}
          {cells.map((date, index) => {
            const summary = date ? calendarByDate.get(date) : undefined;
            const isToday = date === today;
            const dayNumber = date ? Number(date.slice(-2)) : '';
             const hasWork = !!summary && (summary.eventCount > 0 || summary.taskCount > 0 || summary.dueTaskCount > 0 || summary.overdueTaskCount > 0);
             return <button key={date ?? `blank-${index}`} data-testid={date ? `button-calendar-day-${date}` : `button-calendar-empty-${index}`} disabled={!date} onClick={() => date && navigate({ kind: 'day', date })} className={classNames('group relative min-h-0 min-w-0 border-b border-r border-[hsl(var(--border))] p-1.5 text-left align-top transition-colors sm:p-2.5', date ? 'bg-[hsl(var(--background))] hover:bg-[hsl(var(--secondary)/.52)]' : 'cursor-default bg-[hsl(var(--card)/.32)]', isToday && 'bg-[hsl(var(--primary)/.055)]')}>
              {date && <><div className="flex items-start justify-between"><span className={classNames('mono flex h-6 w-6 items-center justify-center text-[12px]', isToday ? 'rounded-full bg-[hsl(var(--primary))] font-medium text-[hsl(var(--primary-foreground))]' : 'text-[hsl(var(--muted-foreground))]')}>{dayNumber}</span>{hasWork && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]" />}</div>
                 <div className="mt-2 space-y-1 sm:mt-3">{summary?.eventCount ? <div className="flex items-center gap-1.5 truncate text-[10px] text-[hsl(var(--foreground)/.76)]"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--primary))]" />{summary.eventCount} event{summary.eventCount === 1 ? '' : 's'}</div> : null}{summary?.taskCount ? <div className="flex items-center gap-1.5 truncate text-[10px] text-[hsl(var(--muted-foreground))]"><span className="h-1.5 w-1.5 shrink-0 rounded-full border border-[hsl(var(--muted-foreground)/.55)]" />{summary.completedTaskCount}/{summary.taskCount} tasks</div> : null}{summary?.dueTaskCount ? <div className="flex items-center gap-1.5 truncate text-[10px] text-[hsl(var(--primary)/.9)]"><CalendarClock size={11} className="shrink-0" />{summary.dueTaskCount} due</div> : null}{summary?.overdueTaskCount ? <div className="flex items-center gap-1.5 truncate text-[10px] text-[hsl(var(--overdue)/.9)]"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--overdue))]" />{summary.overdueTaskCount} overdue</div> : null}</div>
                 <span className="absolute bottom-1.5 right-1.5 text-[10px] text-[hsl(var(--muted-foreground))] opacity-0 transition-opacity group-hover:opacity-100">open <ArrowRight size={10} className="inline" /></span>
              </>}
            </button>;
          })}
     </div>
        <div className="mt-3 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[hsl(var(--border))] pt-2 text-[10px] text-[hsl(var(--muted-foreground))] sm:mt-4 sm:gap-x-5 sm:pt-3"><span className="section-label mr-1">Signals</span><span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--primary))]" /> scheduled time</span><span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full border border-[hsl(var(--muted-foreground)/.55)]" /> open tasks</span><span className="ml-auto hidden sm:block">Select a day to focus</span></div>
       </div>}
      {dueDialogDate && <DueTaskDialog date={dueDialogDate} tags={tags} onClose={() => setDueDialogDate(null)} />}
    </div>
  </div>;
}

type EventFormValues = { title: string; startTime: string; endTime: string; notes: string; color: string; tagIds: string[] };
const colors = ['#d7d7d2', '#b7b8b4', '#979895', '#777875'];

function EventDialog({ date, event, tags, onClose }: { date: string; event?: Event; tags: Tag[]; onClose: () => void }) {
  const create = useCreateEvent();
  const update = useUpdateEvent();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<EventFormValues>({ title: event?.title ?? '', startTime: event?.startTime ?? '09:00', endTime: event?.endTime ?? '10:00', notes: event?.notes ?? '', color: event?.color ?? colors[0], tagIds: event?.tagIds ?? [] });
  const save = () => {
    if (!values.title.trim()) return;
    const onSuccess = () => { queryClient.invalidateQueries({ queryKey: getGetDayQueryKey(date) }); queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey({ month: monthKey(date) }) }); onClose(); };
    if (event) update.mutate({ id: event.id, data: { ...values, title: values.title.trim() } }, { onSuccess });
    else create.mutate({ data: { ...values, date, title: values.title.trim() } }, { onSuccess });
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
     <div className="w-full max-w-[430px] rounded-[var(--radius-md)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-2xl animate-appear">
      <div className="mb-5 flex items-start justify-between"><div><div className="section-label mb-1">{event ? 'Edit event' : 'New event'}</div><h2 className="text-[17px] font-semibold">{event ? event.title : `Plan ${readableDay(date, 'short')}`}</h2></div><button data-testid="button-close-event-dialog" onClick={onClose} className="icon-btn"><X size={15} /></button></div>
      <div className="space-y-3">
        <label className="block"><span className="mb-1.5 block text-[11px] text-[hsl(var(--muted-foreground))]">Title</span><input data-testid="input-event-title" autoFocus className="field" value={values.title} onChange={(e) => setValues({ ...values, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="Give this time a name" /></label>
        <div className="grid grid-cols-2 gap-2"><label><span className="mb-1.5 block text-[11px] text-[hsl(var(--muted-foreground))]">Starts</span><input data-testid="input-event-start" type="time" className="field mono" value={values.startTime} onChange={(e) => setValues({ ...values, startTime: e.target.value })} /></label><label><span className="mb-1.5 block text-[11px] text-[hsl(var(--muted-foreground))]">Ends</span><input data-testid="input-event-end" type="time" className="field mono" value={values.endTime} onChange={(e) => setValues({ ...values, endTime: e.target.value })} /></label></div>
        <label className="block"><span className="mb-1.5 block text-[11px] text-[hsl(var(--muted-foreground))]">Notes <span className="opacity-60">(optional)</span></span><textarea data-testid="input-event-notes" className="field min-h-[66px] resize-none" value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} placeholder="A little context for later" /></label>
        <div><span className="mb-1.5 block text-[11px] text-[hsl(var(--muted-foreground))]">Color</span><div className="flex gap-2">{colors.map((color) => <button key={color} type="button" data-testid={`button-event-color-${color.slice(1)}`} onClick={() => setValues({ ...values, color })} className={classNames('h-5 w-5 rounded-full border-2 transition-transform', values.color === color ? 'scale-110 border-[hsl(var(--foreground))]' : 'border-transparent')} style={{ backgroundColor: color }} />)}</div></div>
        <div><span className="mb-1.5 block text-[11px] text-[hsl(var(--muted-foreground))]">Tags <span className="opacity-60">(optional)</span></span><TagPicker tags={tags} selectedIds={values.tagIds} onChange={(tagIds) => setValues({ ...values, tagIds })} testId="button-event-tags" /></div>
      </div>
      <div className="mt-6 flex justify-end gap-2"><button data-testid="button-cancel-event" onClick={onClose} className="ghost-btn">Cancel</button><button data-testid="button-save-event" onClick={save} disabled={!values.title.trim() || create.isPending || update.isPending} className="primary-btn">{create.isPending || update.isPending ? 'Saving…' : event ? 'Save changes' : 'Add event'}</button></div>
    </div>
  </div>;
}

function DueTaskDialog({ date, task, tags, onClose }: { date: string; task?: Task; tags: Tag[]; onClose: () => void }) {
  const create = useCreateTask();
  const update = useUpdateTask();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(task?.title ?? '');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? date);
  const [tagIds, setTagIds] = useState(task?.tagIds ?? []);
  const save = () => {
    if (!title.trim() || (!task && !dueDate)) return;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: getGetDayQueryKey(date) });
      queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey({ month: monthKey(date) }) });
      if (dueDate) queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey({ month: monthKey(dueDate) }) });
      onClose();
    };
    if (task) update.mutate({ id: task.id, data: { title: title.trim(), dueDate: dueDate || null, tagIds } }, { onSuccess: refresh });
    else create.mutate({ data: { date: dueDate, title: title.trim(), dueDate, tagIds } }, { onSuccess: refresh });
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
    <div className="w-full max-w-[390px] rounded-[var(--radius-md)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-2xl animate-appear">
      <div className="mb-5 flex items-start justify-between"><div><div className="section-label mb-1">{task ? 'Edit due date' : 'New due task'}</div><h2 className="text-[17px] font-semibold">{task ? task.title : 'Something with a deadline'}</h2></div><button data-testid="button-close-due-dialog" onClick={onClose} className="icon-btn"><X size={15} /></button></div>
      <div className="space-y-3">
        <label className="block"><span className="mb-1.5 block text-[11px] text-[hsl(var(--muted-foreground))]">Title</span><input data-testid="input-due-task-title" autoFocus className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs to be done?" /></label>
        <label className="block"><span className="mb-1.5 block text-[11px] text-[hsl(var(--muted-foreground))]">Due on</span><input data-testid="input-due-task-date" type="date" className="field mono" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
        <div><span className="mb-1.5 block text-[11px] text-[hsl(var(--muted-foreground))]">Tags <span className="opacity-60">(optional)</span></span><TagPicker tags={tags} selectedIds={tagIds} onChange={setTagIds} testId="button-due-task-tags" /></div>
        {task?.dueDate && <button data-testid="button-clear-due-date" onClick={() => setDueDate('')} className="text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">Clear due date and keep as a regular task</button>}
      </div>
      <div className="mt-6 flex justify-end gap-2"><button data-testid="button-cancel-due-task" onClick={onClose} className="ghost-btn">Cancel</button><button data-testid="button-save-due-task" onClick={save} disabled={!title.trim() || (!task && !dueDate) || create.isPending || update.isPending} className="primary-btn">{create.isPending || update.isPending ? 'Saving…' : task ? 'Save changes' : 'Add due task'}</button></div>
    </div>
  </div>;
}

function TaskRow({ task, date, tags, onSchedule, onDueDate }: { task: Task; date: string; tags: Tag[]; onSchedule: (task: Task) => void; onDueDate: (task: Task) => void }) {
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const patch = (data: { completed?: boolean; title?: string; dueDate?: string | null; tagIds?: string[] }) => update.mutate({ id: task.id, data }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetDayQueryKey(date) }); queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey({ month: monthKey(date) }) }); } });
  const deleteThis = () => { if (window.confirm('Remove this task?')) remove.mutate({ id: task.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetDayQueryKey(date) }); queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey({ month: monthKey(date) }) }); } }); };
  return <div draggable={task.dueDate === null} data-testid={`row-task-${task.id}`} onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)} className={classNames('task-row group flex min-h-[42px] items-center gap-2 border-b border-[hsl(var(--border)/.7)] py-2.5 transition-colors hover:bg-[hsl(var(--secondary)/.38)]', task.completed && 'opacity-60', isOverdueTask(task) && 'bg-[hsl(var(--overdue)/.055)]')}>
    <GripVertical size={13} className="shrink-0 cursor-grab text-[hsl(var(--muted-foreground)/.45)] opacity-0 transition-opacity group-hover:opacity-100" />
    <button data-testid={`button-toggle-task-${task.id}`} onClick={() => patch({ completed: !task.completed })} className={classNames('flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] border transition-all', task.completed ? 'border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] check-pop' : 'border-[hsl(var(--muted-foreground)/.6)] hover:border-[hsl(var(--primary))]')}><Check size={10} strokeWidth={3} /></button>
    {editing ? <input data-testid={`input-edit-task-${task.id}`} autoFocus className="field h-[28px] min-w-0 flex-1 border-0 bg-transparent px-1 py-0 text-[12px]" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => { if (title.trim() && title !== task.title) patch({ title: title.trim() }); setEditing(false); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setTitle(task.title); setEditing(false); } }} /> : <button data-testid={`button-edit-task-${task.id}`} onClick={() => setEditing(true)} className={classNames('min-w-0 flex-1 truncate text-left text-[12px]', task.completed ? 'text-[hsl(var(--muted-foreground))] line-through' : 'text-[hsl(var(--foreground)/.88)]')}>{task.title}</button>}
    <TagPills tagIds={task.tagIds} tags={tags} />
    <TagPicker tags={tags} selectedIds={task.tagIds} onChange={(tagIds) => patch({ tagIds })} testId={`button-task-tags-${task.id}`} />
    {task.dueDate && <span className={classNames('hidden text-[10px] sm:inline', isOverdueTask(task) ? 'text-[hsl(var(--overdue)/.9)]' : 'text-[hsl(var(--primary)/.8)]')}>{isOverdueTask(task) ? `overdue · ${dueDateLabel(task.dueDate)}` : `due ${dueDateLabel(task.dueDate)}`}</span>}
    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100"><button data-testid={`button-edit-due-task-${task.id}`} onClick={() => onDueDate(task)} className="icon-btn h-6 w-6" title={task.dueDate ? 'Edit due date' : 'Set due date'}><CalendarClock size={12} /></button>{!task.completed && !task.scheduledEventId && <button data-testid={`button-schedule-task-${task.id}`} onClick={() => onSchedule(task)} className="icon-btn h-6 w-6" title="Schedule task"><Clock3 size={12} /></button>}<button data-testid={`button-delete-task-${task.id}`} onClick={deleteThis} className="icon-btn h-6 w-6 hover:text-[hsl(var(--foreground))]" title="Delete task"><Trash2 size={12} /></button></div>
  </div>;
}

function ScheduleDialog({ date, task, tags, onClose }: { date: string; task: Task; tags: Tag[]; onClose: () => void }) {
  const schedule = useScheduleTask();
  const queryClient = useQueryClient();
  const [startTime, setStart] = useState('09:00');
  const [endTime, setEnd] = useState('10:00');
  const [tagIds, setTagIds] = useState(task.tagIds ?? []);
  const save = () => schedule.mutate({ id: task.id, data: { startTime, endTime, color: colors[1], tagIds } }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetDayQueryKey(date) }); queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey({ month: monthKey(date) }) }); onClose(); } });
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"><div className="w-full max-w-[360px] rounded-[var(--radius-md)] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-2xl animate-appear"><div className="mb-4 flex justify-between"><div><div className="section-label mb-1">Make time</div><h2 className="max-w-[270px] truncate text-[15px] font-semibold">{task.title}</h2></div><button data-testid="button-close-schedule-dialog" onClick={onClose} className="icon-btn"><X size={15} /></button></div><div className="grid grid-cols-2 gap-2"><label><span className="mb-1.5 block text-[11px] muted">Starts</span><input data-testid="input-schedule-start" type="time" className="field mono" value={startTime} onChange={(e) => setStart(e.target.value)} /></label><label><span className="mb-1.5 block text-[11px] muted">Ends</span><input data-testid="input-schedule-end" type="time" className="field mono" value={endTime} onChange={(e) => setEnd(e.target.value)} /></label></div><div className="mt-3"><span className="mb-1.5 block text-[11px] muted">Tags</span><TagPicker tags={tags} selectedIds={tagIds} onChange={setTagIds} testId="button-schedule-tags" /></div><div className="mt-5 flex justify-end gap-2"><button data-testid="button-cancel-schedule" onClick={onClose} className="ghost-btn">Cancel</button><button data-testid="button-save-schedule" onClick={save} disabled={schedule.isPending} className="primary-btn">{schedule.isPending ? 'Scheduling…' : 'Schedule'}</button></div></div></div>;
}

function EventRow({ event, date, tags, onEdit }: { event: Event; date: string; tags: Tag[]; onEdit: (event: Event) => void }) {
  const remove = useDeleteEvent();
  const queryClient = useQueryClient();
  const deleteThis = () => { if (window.confirm(`Remove “${event.title}”?`)) remove.mutate({ id: event.id }, { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetDayQueryKey(date) }); queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey({ month: monthKey(date) }) }); } }); };
  const accentTag = tags.find((tag) => event.tagIds?.includes(tag.id));
  const accent = accentTag ? tagDisplayColor(accentTag) : event.color ?? colors[0];
  return <div data-testid={`row-event-${event.id}`} className="group relative flex min-h-[46px] gap-3 border-b border-[hsl(var(--border)/.7)] py-2.5 transition-colors hover:bg-[hsl(var(--secondary)/.28)]"><div className="mono w-[58px] shrink-0 pt-0.5 text-right text-[10px] leading-4 text-[hsl(var(--muted-foreground))]">{displayTime(event.startTime)}<br /><span className="opacity-60">{displayTime(event.endTime)}</span></div><div className="relative min-w-0 flex-1 border-l-2 pl-3" style={{ borderColor: accent }}><div className="flex min-w-0 items-center gap-2"><div className="truncate text-[12px] font-semibold text-[hsl(var(--foreground)/.9)]">{event.title}</div><TagPills tagIds={event.tagIds} tags={tags} /></div>{event.notes && <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-[hsl(var(--muted-foreground))]">{event.notes}</div>}</div><div className="absolute right-2 top-2 flex opacity-0 transition-opacity group-hover:opacity-100"><button data-testid={`button-edit-event-${event.id}`} onClick={() => onEdit(event)} className="icon-btn h-6 w-6"><MoreHorizontal size={13} /></button><button data-testid={`button-delete-event-${event.id}`} onClick={deleteThis} className="icon-btn h-6 w-6 hover:text-[hsl(var(--destructive))]"><Trash2 size={12} /></button></div></div>;
}

function DayView({ date }: { date: string }) {
  const { navigate } = useNavigation();
  const { data, isLoading, isError, refetch } = useGetDay(date);
  const { data: tags = [] } = useGetTags();
  const queryClient = useQueryClient();
  const createTask = useCreateTask();
  const reorder = useReorderTasks();
  const [newTask, setNewTask] = useState('');
  const [newTaskTags, setNewTaskTags] = useState<string[]>([]);
  const [eventOpen, setEventOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<Event | undefined>();
  const [scheduleTask, setScheduleTask] = useState<Task | undefined>();
  const [dueDialogTask, setDueDialogTask] = useState<Task | undefined>();
  const [dragTask, setDragTask] = useState<string | null>(null);
  const tasks = useMemo(() => [...(data?.tasks ?? [])].sort((a, b) => a.position - b.position), [data?.tasks]);
  const dueTasks = useMemo(() => tasks.filter((task) => task.dueDate !== null), [tasks]);
  const regularTasks = useMemo(() => tasks.filter((task) => task.dueDate === null), [tasks]);
  const events = useMemo(() => [...(data?.events ?? [])].sort((a, b) => a.startTime.localeCompare(b.startTime)), [data?.events]);
  const addTask = () => { if (!newTask.trim()) return; createTask.mutate({ data: { date, title: newTask.trim(), tagIds: newTaskTags } }, { onSuccess: () => { setNewTask(''); setNewTaskTags([]); queryClient.invalidateQueries({ queryKey: getGetDayQueryKey(date) }); queryClient.invalidateQueries({ queryKey: getGetCalendarQueryKey({ month: monthKey(date) }) }); } }); };
  const dropTask = (targetId: string) => {
    if (!dragTask || dragTask === targetId) return;
    const next = [...regularTasks]; const from = next.findIndex((item) => item.id === dragTask); const to = next.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) return; const [moved] = next.splice(from, 1); next.splice(to, 0, moved);
    reorder.mutate({ data: { date, taskIds: next.map((task) => task.id) } }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetDayQueryKey(date) }) }); setDragTask(null);
  };
  if (isLoading) return <LoadingState />;
  if (isError || !data) return <ErrorState retry={refetch} />;
  const done = tasks.filter((task) => task.completed).length;
  return <div className="h-full min-h-0 overflow-hidden">
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1220px] flex-col p-3 sm:p-5 lg:p-7">
        <div className="mb-3 flex shrink-0 items-end justify-between gap-3 animate-appear sm:mb-4"><div><button data-testid="button-back-calendar" onClick={() => navigate({ kind: 'calendar' })} className="mb-2 flex items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"><ArrowLeft size={13} /> Calendar</button><div className="section-label mb-1">Daily focus</div><h1 data-testid="text-day-title" className="text-[25px] font-semibold tracking-[-.03em]">{readableDay(date)}</h1><p data-testid="text-day-progress" className="mt-1 text-[12px] text-[hsl(var(--muted-foreground))]">{done} of {tasks.length} tasks done</p></div><div className="flex shrink-0 items-center gap-1"><button data-testid="button-previous-day" onClick={() => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() - 1); navigate({ kind: 'day', date: isoDate(d) }); }} className="icon-btn"><ChevronLeft size={16} /></button><button data-testid="button-next-day" onClick={() => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + 1); navigate({ kind: 'day', date: isoDate(d) }); }} className="icon-btn"><ChevronRight size={16} /></button></div></div>
        <div className="day-view-grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] lg:grid-rows-1 lg:gap-x-8">
          <section className="day-panel flex min-h-0 flex-col animate-slide" style={{ animationDelay: '.04s' }}><div className="day-panel-header shrink-0"><div className="flex items-center gap-2"><Clock3 size={14} className="text-[hsl(var(--primary))]" /><h2 className="text-[12px] font-semibold">Schedule</h2><span className="mono text-[10px] text-[hsl(var(--muted-foreground))]">{events.length}</span></div><button data-testid="button-add-event" onClick={() => { setEditEvent(undefined); setEventOpen(true); }} className="ghost-btn min-h-[27px] px-2 text-[11px]"><Plus size={13} /> Event</button></div><div className="day-panel-scroll">{events.length ? <div>{events.map((event) => <EventRow key={event.id} event={event} date={date} tags={tags} onEdit={(item) => { setEditEvent(item); setEventOpen(true); }} />)}</div> : <div className="day-panel-empty"><div className="mb-2 text-[12px] text-[hsl(var(--muted-foreground))]">The day is open.</div><button data-testid="button-add-first-event" onClick={() => setEventOpen(true)} className="text-[11px] text-[hsl(var(--primary))] hover:underline">Give it a shape <ArrowRight size={11} className="inline" /></button></div>}</div></section>
          <section className="day-panel animate-slide" style={{ animationDelay: '.1s' }}>
            <div className="day-panel-header"><div className="flex items-center gap-2"><ListTodo size={14} className="text-[hsl(var(--accent))]" /><h2 className="text-[12px] font-semibold">Tasks</h2><span className="mono text-[10px] text-[hsl(var(--muted-foreground))]">{done}/{tasks.length}</span></div><span className="section-label">drag to sort</span></div>
             <div className="day-task-scroll">
              <div className="day-task-list">
             <div className="flex items-center gap-2 px-2 py-2 text-[10px] uppercase tracking-[.12em] text-[hsl(var(--primary)/.9)]"><CalendarClock size={12} /><span>Due today</span><span className="mono ml-auto">{dueTasks.filter((task) => isOverdueTask(task)).length ? `${dueTasks.filter((task) => isOverdueTask(task)).length} overdue` : dueTasks.length}</span></div>
             {dueTasks.length ? dueTasks.map((task) => <TaskRow key={task.id} task={task} date={date} tags={tags} onSchedule={setScheduleTask} onDueDate={setDueDialogTask} />) : <div className="px-2 pb-3 text-[11px] text-[hsl(var(--muted-foreground))]">Nothing due on this day.</div>}
              </div>
            {dueTasks.length > 0 && regularTasks.length > 0 && <div className="day-list-divider" />}
            <div className="py-1">{regularTasks.length ? regularTasks.map((task) => <div key={task.id} onDragOver={(e) => e.preventDefault()} onDrop={() => dropTask(task.id)}><TaskRow task={task} date={date} tags={tags} onSchedule={setScheduleTask} onDueDate={setDueDialogTask} /></div>) : <div className="py-6 text-center text-[12px] text-[hsl(var(--muted-foreground))]">Nothing competing for your attention.</div>}</div>
             </div>
             <div className="day-task-composer shrink-0"><input data-testid="input-new-task" className="field h-[32px] min-w-0 flex-1 border-0 bg-transparent px-1 text-[12px]" value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} placeholder="What matters today?" /><TagPicker tags={tags} selectedIds={newTaskTags} onChange={setNewTaskTags} testId="button-new-task-tags" /><button data-testid="button-add-task" onClick={addTask} disabled={!newTask.trim() || createTask.isPending} className="icon-btn shrink-0 text-[hsl(var(--primary))]"><Plus size={16} /></button></div>
         </section>
      </div>
    </div>
    {eventOpen && <EventDialog date={date} event={editEvent} tags={tags} onClose={() => setEventOpen(false)} />}
    {scheduleTask && <ScheduleDialog date={date} task={scheduleTask} tags={tags} onClose={() => setScheduleTask(undefined)} />}
     {dueDialogTask && <DueTaskDialog date={date} task={dueDialogTask} tags={tags} onClose={() => setDueDialogTask(undefined)} />}
  </div>;
}

function Router() {
  const [route, setRoute] = useState<AppRoute>({ kind: 'calendar' });
  const navigationSequence = useRef(0);
  const navigate = useCallback(async (nextRoute: AppRoute) => {
    const sequence = ++navigationSequence.current;
    if (nextRoute.kind === 'day') {
      try {
        await queryClient.prefetchQuery(getGetDayQueryOptions(nextRoute.date));
      } catch {
        // The destination renders its normal retry state when a prefetch fails.
      }
    }
    if (sequence === navigationSequence.current) setRoute(nextRoute);
  }, []);
  const navigation = useMemo(() => ({ route, navigate }), [route, navigate]);
  return <NavigationContext.Provider value={navigation}><ErrorBoundary resetKey={route.kind === 'day' ? route.date : route.kind}><AppShell>{route.kind === 'day' ? <DayView date={route.date} /> : <CalendarHome />}</AppShell></ErrorBoundary></NavigationContext.Provider>;
}

export default function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router /><Toaster /></TooltipProvider></QueryClientProvider>;
}