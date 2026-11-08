import { DashboardPage, EmptyState, PipelineStatus } from '@am/ui';
import { createFileRoute } from '@tanstack/react-router';
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

/** Home of the member area: the way to the first application, until the next slices fill it. */
export const Route = createFileRoute('/_member/')({
  component: MemberHome,
});

function MemberHome() {
  const { access } = Route.useRouteContext();

  return (
    <DashboardPage.Root>
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
        {STEPS.map((step) => (
          <DashboardPage.Widget key={step.number} span={4}>
            <DashboardPage.Widget.Header>
              <span className="font-mono text-text-muted">{step.number}</span>
              <PipelineStatus
                status={step.done ? 'accepted' : 'saved'}
                label={step.done ? 'Concluído' : 'A fazer'}
                iconOnly
              />
            </DashboardPage.Widget.Header>
            <DashboardPage.Widget.Title>{step.title}</DashboardPage.Widget.Title>
            <p className="text-text-muted">{step.text}</p>
          </DashboardPage.Widget>
        ))}
      </DashboardPage.Grid>
      <EmptyState.Root>
        <p>
          Quando houver candidaturas, aqui aparecem o pipeline, o que precisa de atenção e a
          atividade recente.
        </p>
      </EmptyState.Root>
    </DashboardPage.Root>
  );
}
