import {
  Activity,
  ArrowLeftRight,
  Bot,
  ChartNoAxesCombined,
  Cpu,
  FlaskConical,
  FolderClock,
  Gauge,
  Layers3,
  Settings2,
  Workflow,
} from 'lucide-react';
export const navigation = [
  {
    label: 'WORKSPACE',
    items: [
      {
        slug: '',
        name: 'Overview',
        icon: Gauge,
        milestone: 'M0',
        description: 'Your hardware intelligence workspace.',
      },
      {
        slug: 'system-monitor',
        name: 'System Monitor',
        icon: Activity,
        milestone: 'M4',
        description:
          'Fresh/stale measured samples from an authorized bounded local runner.',
      },
      {
        slug: 'hardware-library',
        name: 'Hardware Library',
        icon: Cpu,
        milestone: 'M1',
        description: 'Create and manage your CPU, GPU, and computer profiles.',
      },
    ],
  },
  {
    label: 'PERFORMANCE',
    items: [
      {
        slug: 'workload-analyzer',
        name: 'Workload Analyzer',
        icon: Workflow,
        milestone: 'M2',
        description: 'Describe a workload and calculate an analytical execution-time estimate.',
      },
      {
        slug: 'cpu-vs-gpu',
        name: 'CPU vs GPU',
        icon: ArrowLeftRight,
        milestone: 'M2',
        description:
          'Compare calculated execution times, transfer overhead, and device suitability.',
      },
      {
        slug: 'benchmark-lab',
        name: 'Benchmark Lab',
        icon: FlaskConical,
        milestone: 'M4',
        description: 'Run authorized local benchmarks and record measured results.',
      },
      {
        slug: 'ml-predictions',
        name: 'ML Predictions',
        icon: ChartNoAxesCombined,
        milestone: 'M3',
        description:
          'Train regression models using validated datasets and evaluate their predictions.',
      },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      {
        slug: 'ai-assistant',
        name: 'AI Assistant',
        icon: Bot,
        milestone: 'M6',
        description:
          'Ask questions with authenticated application tools and a configured LLM provider.',
      },
      {
        slug: 'explainability',
        name: 'Explainability',
        icon: Layers3,
        milestone: 'M5',
        description: 'Explore SHAP contributions computed from real trained model artifacts.',
      },
      {
        slug: 'reports',
        name: 'Reports',
        icon: FolderClock,
        milestone: 'M7',
        description: 'Export and share hardware comparisons, predictions, and benchmark reports.',
      },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      {
        slug: 'settings',
        name: 'Settings',
        icon: Settings2,
        milestone: 'M0',
        description: 'Personalize your CoreWise workspace.',
      },
    ],
  },
];
export const pages = navigation.flatMap((group) => group.items);
