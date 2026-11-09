import { AppShell, Button, DashboardPage, EmptyState, PipelineStatus } from '@am/ui';
import { createFileRoute, getRouteApi, Link } from '@tanstack/react-router';
import { greetingFor } from '../../features/identity';

/** The three steps of the first application. The first one is done by the invitation itself (AD-010). */
const STEPS = [
  {
    number: '01',
    done: true,
    title: 'Conta criada',
    text: 'Você entrou por convite. Nada a fazer aqui.',
  },
  {
    number: '02',
    done: false,
    title: 'Preencha o currículo mestre',
    text: 'Experiências e bullets marcados por skill. É dele que sai cada versão adaptada.',
  },
  {
    number: '03',
    done: false,
    title: 'Cadastre uma vaga',
    text: 'Empresa, título, nível e as skills pedidas. Leva menos de 2 minutos.',
  },
] as const;

/** The step that is done by using the product: the first application (APP-84). */
const APPLICATION_STEP = '03';

const memberLayout = getRouteApi('/_member');

/**
 * Home of the member area: the topbar "Início" edge to edge, then the way to the first application,
 * until the next slices fill it.
 */
export const Route = createFileRoute('/_member/')({
  component: MemberHome,
});

function MemberHome() {
  const { access } = Route.useRouteContext();
  // The total the layout already read for the sidebar: with one application, step 03 is done (APP-84).
  const { total } = memberLayout.useLoaderData();
  const hasApplication = total !== undefined && total > 0;

  return (
    <DashboardPage.Root>
      <AppShell.Topbar>
        <b className="text-body font-medium">Início</b>
      </AppShell.Topbar>
      <DashboardPage.Content>
        <DashboardPage.Header>
          <h1 className="text-heading-lg">Início</h1>
          <p className="text-body-lg">
            {greetingFor(access.kind === 'allowed' ? access.user.name : '')}
          </p>
          <p className="text-text-muted">
            Três passos para a primeira candidatura com currículo adaptado.
          </p>
        </DashboardPage.Header>
        <DashboardPage.Grid>
          {STEPS.map((step) => {
            const done = step.done || (step.number === APPLICATION_STEP && hasApplication);
            return (
              <DashboardPage.Widget key={step.number} span={4}>
                <DashboardPage.Widget.Header>
                  <span className="font-mono text-text-muted">{step.number}</span>
                  <PipelineStatus
                    status={done ? 'accepted' : 'saved'}
                    label={done ? 'Concluído' : 'A fazer'}
                    iconOnly
                  />
                </DashboardPage.Widget.Header>
                <DashboardPage.Widget.Title>{step.title}</DashboardPage.Widget.Title>
                <p className="text-text-muted">{step.text}</p>
                {step.number === APPLICATION_STEP ? (
                  <Button asChild intent="secondary" size="sm">
                    <Link to="/applications" search={{ new: 1 }}>
                      Nova candidatura
                    </Link>
                  </Button>
                ) : null}
              </DashboardPage.Widget>
            );
          })}
        </DashboardPage.Grid>
        <EmptyState.Root>
          <p>
            Quando houver candidaturas, aqui aparecem o pipeline, o que precisa de atenção e a
            atividade recente.
          </p>
        </EmptyState.Root>
      </DashboardPage.Content>
    </DashboardPage.Root>
  );
}
