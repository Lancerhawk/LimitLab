import { useNavigate } from 'react-router-dom';
import {
  Info,
  Droplets,
  LayoutGrid,
  ScrollText,
  Filter,
  Play,
  BarChart3,
  GitCompare,
  Database,
  Zap,
  Download,
  Globe,
  BookOpen,
  UserPlus,
  Settings2,
  FlaskConical,
  Eye,
  Scale,
  GraduationCap,
  CheckCircle2,
  ArrowRight,
  Gauge,
  Shield,
  HardDrive,
  Target,
  Clock,
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

// ─── Algorithm Data ───────────────────────────────────────────────────────────

const algorithms = [
  {
    name: 'Token Bucket',
    icon: Droplets,
    description: 'Tokens are added at a constant rate and consumed per request. Allows controlled bursts while enforcing a steady average rate.',
    bestFor: 'Burst-tolerant APIs',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    name: 'Fixed Window',
    icon: LayoutGrid,
    description: 'Divides time into fixed intervals and counts requests within each window. Simple to implement but vulnerable to boundary spikes.',
    bestFor: 'Simple rate caps',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    name: 'Sliding Window Counter',
    icon: BarChart3,
    description: 'Blends the current and previous window counts using a weighted average, smoothing boundary spikes with minimal memory overhead.',
    bestFor: 'Balanced fairness',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
  },
  {
    name: 'Sliding Log',
    icon: ScrollText,
    description: 'Records every request timestamp in a rolling window for maximum precision. Highest accuracy at the cost of memory and compute.',
    bestFor: 'Precision-critical systems',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    name: 'Leaky Bucket',
    icon: Filter,
    description: 'Incoming requests queue up and are processed at a fixed outflow rate. Excess requests are dropped when the queue is full.',
    bestFor: 'Strict traffic shaping',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
  },
];

// ─── Features Data ────────────────────────────────────────────────────────────

const features = [
  {
    icon: Play,
    title: 'Interactive Playground',
    description: 'Experiment with live requests against real algorithm implementations in real-time.',
  },
  {
    icon: BarChart3,
    title: 'Visual Simulation',
    description: 'Visualize algorithm behavior step-by-step with timelines and request graphs.',
  },
  {
    icon: GitCompare,
    title: 'Algorithm Comparison',
    description: 'Compare two algorithms side-by-side with synchronized playback inside the Simulator.',
  },
  {
    icon: Database,
    title: 'Database-Backed Implementations',
    description: 'Observe persistent state behavior with PostgreSQL-backed rate limiting.',
  },
  {
    icon: Zap,
    title: 'In-Memory Implementations',
    description: 'Test high-performance local execution using LRU cache-based algorithms.',
  },
  {
    icon: Download,
    title: 'Downloadable Load Test Scripts',
    description: 'Stress-test algorithms using auto-generated Node.js, Python, or Bash scripts.',
  },
  {
    icon: Globe,
    title: 'Public Testing Endpoints',
    description: 'Integrate external tools or custom scripts against open sandbox API endpoints.',
  },
  {
    icon: BookOpen,
    title: 'Documentation',
    description: 'Learn the concepts, architecture, and trade-offs behind every algorithm.',
  },
];

// ─── Workflow Steps ───────────────────────────────────────────────────────────

const workflowSteps = [
  { icon: UserPlus, label: 'Create Client' },
  { icon: FlaskConical, label: 'Choose Algorithm' },
  { icon: Settings2, label: 'Configure Parameters' },
  { icon: Play, label: 'Test Requests' },
  { icon: Eye, label: 'Observe Simulation' },
  { icon: Scale, label: 'Compare Behavior' },
  { icon: GraduationCap, label: 'Learn' },
];

// ─── Trade-off Dimensions ─────────────────────────────────────────────────────

const tradeoffs = [
  { icon: Gauge, label: 'Burst Tolerance', description: 'How well the algorithm handles sudden traffic spikes.' },
  { icon: Shield, label: 'Fairness', description: 'How evenly rate limits are distributed across a time window.' },
  { icon: HardDrive, label: 'Memory Usage', description: 'How much state the algorithm needs to store per client.' },
  { icon: Target, label: 'Precision', description: 'How accurately the algorithm enforces the configured limit.' },
  { icon: Filter, label: 'Traffic Shaping', description: 'How effectively the algorithm smooths bursty traffic into steady output.' },
  { icon: Clock, label: 'Latency', description: 'How much overhead each request check adds to response time.' },
];

// ─── Algorithms Support Matrix ────────────────────────────────────────────────

const supportMatrix = [
  { algorithm: 'Token Bucket',           database: true, inMemory: true, simulation: true, playground: true, loadTesting: true },
  { algorithm: 'Fixed Window',           database: true, inMemory: true, simulation: true, playground: true, loadTesting: true },
  { algorithm: 'Sliding Window Counter', database: true, inMemory: true, simulation: true, playground: true, loadTesting: true },
  { algorithm: 'Sliding Log',            database: true, inMemory: true, simulation: true, playground: true, loadTesting: true },
  { algorithm: 'Leaky Bucket',           database: true, inMemory: true, simulation: true, playground: true, loadTesting: true },
];

// ─── Getting Started Steps ────────────────────────────────────────────────────

const gettingStartedSteps = [
  'Create a Client from the Clients page.',
  'Select a rate limiting algorithm for the client.',
  'Configure algorithm parameters (capacity, refill rate, window duration, etc.).',
  'Test using the Playground to send requests and observe responses.',
  'Observe behavior visually in the Simulation engine.',
  'Experiment with load testing using downloadable scripts.',
  'Explore the Documentation to understand trade-offs.',
];

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-16 pb-16">
      {/* ─── Hero Section ──────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="text-center space-y-6 py-8">
          <img src="/logo.png" alt="LimitLab" className="w-20 h-20 mx-auto" />
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
            LimitLab
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            An interactive playground for learning, visualizing, and testing modern rate limiting algorithms. Experiment with real implementations backed by PostgreSQL and in-memory caches, compare algorithm behavior under different traffic patterns, and understand how rate limiting works from theory to production.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            <Button onClick={() => navigate('/clients')} className="gap-2">
              <Play className="h-4 w-4" /> Start Testing
            </Button>
            <Button variant="secondary" onClick={() => navigate('/simulator')} className="gap-2">
              <BarChart3 className="h-4 w-4" /> Open Simulation
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => window.open('https://github.com/Lancerhawk/LimitLab', '_blank')}
            >
              <BookOpen className="h-4 w-4" /> Read Documentation
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Sandbox Banner ────────────────────────────────────────────── */}
      <div className="bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-xl p-4 flex gap-3 text-sm items-start">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <strong className="block mb-1 font-semibold text-blue-400">Public Sandbox Restrictions Active</strong>
          To prevent abuse, this public sandbox instance enforces strict global limits:
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li><strong>Hard Sandbox Burst Ceiling:</strong> 500 requests per second maximum for in-memory algorithm load testing.</li>
            <li><strong>Sandbox Sustained Limit:</strong> 3,000 requests per 15 minutes for in-memory testing.</li>
            <li><strong>Global API Limit:</strong> 100 requests per 15 minutes for all other endpoints (including database-backed algorithm testing).</li>
          </ol>
        </div>
      </div>

      {/* ─── Algorithms Overview ───────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Implemented Algorithms</h2>
          <p className="text-sm text-muted-foreground">Five production-grade rate limiting strategies, each with unique strengths.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {algorithms.map((algo) => {
            const Icon = algo.icon;
            return (
              <Card key={algo.name} className={`border ${algo.bg} transition-all hover:shadow-md hover:scale-[1.02]`}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-background/50 ${algo.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-sm">{algo.name}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{algo.description}</p>
                  <Badge variant="outline" className="text-[10px]">{algo.bestFor}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ─── Platform Features ─────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Platform Features</h2>
          <p className="text-sm text-muted-foreground">Everything you need to explore rate limiting in depth.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="border border-border/40 transition-all hover:border-primary/20 hover:shadow-md">
                <CardContent className="p-5 space-y-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary w-fit">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-sm">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ─── How It Works ──────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">How It Works</h2>
          <p className="text-sm text-muted-foreground">From setup to insight in seven steps.</p>
        </div>
        <div className="flex flex-col md:flex-row items-stretch gap-0">
          {workflowSteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center text-center flex-1 p-4">
                  <div className="p-3 rounded-xl bg-primary/10 text-primary mb-3">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium text-foreground">{step.label}</span>
                  <span className="text-[10px] text-muted-foreground mt-1">Step {index + 1}</span>
                </div>
                {index < workflowSteps.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 hidden md:block" />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Supported Algorithms Table ────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Algorithm Support Matrix</h2>
          <p className="text-sm text-muted-foreground">Every algorithm is fully integrated across all platform capabilities.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-border/40 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-muted/20 border-b border-border/40">
                <th className="text-left px-4 py-3 font-semibold text-foreground">Algorithm</th>
                <th className="text-center px-4 py-3 font-semibold text-foreground">Database</th>
                <th className="text-center px-4 py-3 font-semibold text-foreground">In-Memory</th>
                <th className="text-center px-4 py-3 font-semibold text-foreground">Simulation</th>
                <th className="text-center px-4 py-3 font-semibold text-foreground">Playground</th>
                <th className="text-center px-4 py-3 font-semibold text-foreground">Load Testing</th>
              </tr>
            </thead>
            <tbody>
              {supportMatrix.map((row) => (
                <tr key={row.algorithm} className="border-b border-border/20 hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{row.algorithm}</td>
                  <td className="text-center px-4 py-3">{row.database && <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />}</td>
                  <td className="text-center px-4 py-3">{row.inMemory && <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />}</td>
                  <td className="text-center px-4 py-3">{row.simulation && <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />}</td>
                  <td className="text-center px-4 py-3">{row.playground && <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />}</td>
                  <td className="text-center px-4 py-3">{row.loadTesting && <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Why Different Algorithms Exist ─────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Why Different Algorithms Exist</h2>
          <p className="text-sm text-muted-foreground">
            No single rate limiting algorithm is universally best. Each optimizes for different operational goals. The right choice depends on your system's specific requirements.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tradeoffs.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-start gap-3 p-4 rounded-xl border border-border/30 bg-card/50">
                <div className="p-2 rounded-lg bg-muted/30 text-muted-foreground shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{item.label}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Getting Started ───────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Getting Started</h2>
          <p className="text-sm text-muted-foreground">Seven steps to become proficient with rate limiting.</p>
        </div>
        <div className="space-y-3">
          {gettingStartedSteps.map((step, index) => (
            <div key={index} className="flex items-start gap-4 p-4 rounded-xl border border-border/30 bg-card/50 transition-all hover:border-primary/20">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
                {index + 1}
              </div>
              <p className="text-sm text-foreground pt-1">{step}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
