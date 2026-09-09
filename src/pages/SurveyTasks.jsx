import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as surveyApi from '../api/survey';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../auth/AuthContext';
import { can } from '../auth/permissions';
import * as fmt from '../lib/format';
import PageHeader from '../components/layout/PageHeader';
import StatusBadge from '../components/case/StatusBadge';
import FilterBar from '../components/ui/FilterBar';
import Loading from '../components/states/Loading';
import ErrorState from '../components/states/ErrorState';
import Empty from '../components/states/Empty';
import '../components/case/case.css';
import './fieldwork.css';

/* Part 13's own section list: Assigned, In Progress, Returned, Submitted,
   Approved. A field officer sees only their own tasks; a supervisor
   (District Officer/SLAO/Admin) sees every task on a case in their scope —
   the backend decides which, this page just renders whatever comes back. */
const SECTIONS = [
  { status: 'assigned', title: 'Assigned' },
  { status: 'in_progress', title: 'In progress' },
  { status: 'returned', title: 'Returned' },
  { status: 'submitted', title: 'Submitted' },
  { status: 'approved', title: 'Approved' },
];

export default function SurveyTasks() {
  const { user } = useAuth();
  const tasks = useApi((opts) => surveyApi.list({}, opts), []);
  const [query, setQuery] = useState('');

  // Client-side: GET /survey-tasks returns the caller's whole scoped set in
  // one shot (see app/routers/survey.py), so filtering it here needs no new
  // backend param.
  const needle = query.trim().toLowerCase();
  const visibleTasks = useMemo(() => {
    const items = (tasks.data && tasks.data.items) || [];
    if (!needle) return items;
    return items.filter((task) =>
      [task.case_number, task.village_name, task.project_name, task.parcel_survey_number]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(needle)),
    );
  }, [tasks.data, needle]);

  const grouped = useMemo(() => {
    const map = {};
    for (const section of SECTIONS) map[section.status] = [];
    for (const task of visibleTasks) {
      (map[task.status] || (map[task.status] = [])).push(task);
    }
    return map;
  }, [visibleTasks]);

  return (
    <>
      <PageHeader
        title="My Surveys"
        subtitle={
          can.assignSurvey(user)
            ? 'Every field survey task on a case in your district.'
            : 'Field survey work assigned to you, from assignment to review.'
        }
      />

      {tasks.data && tasks.data.items.length > 0 && (
        <FilterBar>
          <FilterBar.Search
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by case number, survey number, village or project…"
          />
        </FilterBar>
      )}

      {tasks.loading && <Loading label="Loading surveys" rows={3} />}
      {tasks.error && <ErrorState error={tasks.error} onRetry={tasks.reload} />}

      {tasks.data && tasks.data.items.length === 0 && (
        <Empty
          center
          title="No survey tasks yet"
          body="Start one from a case in Field Work, or assign one from a case page."
        />
      )}

      {tasks.data && tasks.data.items.length > 0 && visibleTasks.length === 0 && (
        <Empty center title="No matches" body={`No survey task matches "${query.trim()}".`} />
      )}

      {tasks.data &&
        visibleTasks.length > 0 &&
        SECTIONS.map((section) => {
          const items = grouped[section.status] || [];
          if (items.length === 0) return null;
          return (
            <section className="section" key={section.status}>
              <div className="section__head">
                <h2 className="section__title">{section.title}</h2>
                <span className="section__count">{items.length}</span>
              </div>
              <div className="field-queue">
                {items.map((task) => (
                  <SurveyCard key={task.id} task={task} />
                ))}
              </div>
            </section>
          );
        })}
    </>
  );
}

function SurveyCard({ task }) {
  return (
    <Link
      to={`/survey-tasks/${task.id}`}
      className={`field-card field-card--link${task.status === 'returned' ? ' is-overdue' : ''}`}
    >
      <header className="field-card__head">
        <div>
          <span className="case-number">{task.case_number}</span>
          <h2 className="field-card__village">{task.village_name}</h2>
          <p className="field-card__project">
            {task.project_name}
            {task.parcel_survey_number ? ` · Survey ${task.parcel_survey_number}` : ''}
          </p>
        </div>
        <StatusBadge kind="surveyTask" value={task.status} />
      </header>

      <p className="field-card__stage">
        {task.assigned_by_name ? `Assigned by ${task.assigned_by_name}` : 'Self-started'}
        {task.due_on && <span className="field-card__due">{' · Due ' + fmt.date(task.due_on)}</span>}
      </p>

      {task.status === 'returned' && task.review_note && (
        <p className="benefit-row__note">{task.review_note}</p>
      )}
    </Link>
  );
}
