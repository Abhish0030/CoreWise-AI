'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import Link from 'next/link';
import {
  hardwareListSchema,
  hardwareResponseSchema,
  type HardwareProfile,
  type CurrentUser,
} from '@corewise/types';
import {
  Cpu,
  Layers3,
  Plus,
  Search,
  X,
  Pencil,
  Trash2,
  ArrowRight,
  Star,
  Check,
  Monitor,
  Eye,
  MemoryStick,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProvenanceBadge } from '@/components/metric-card';
import { apiData, apiRequest, ApiClientError } from '@/lib/api';
import { useAuth } from '@/features/auth/use-auth';
import { HardwareForm } from './profile-form';

function Specs({ profile, full = false }: { profile: HardwareProfile; full?: boolean }) {
  const p = profile;
  const rows = full
    ? [
        ['Manufacturer', p.manufacturer],
        ['Device model', p.deviceModel],
        ['Operating system', p.os],
        ['CPU manufacturer', p.cpuManufacturer],
        ['CPU model', p.cpuName],
        ['Physical cores', p.physicalCores],
        ['Logical processors', p.logicalProcessors],
        ['Base frequency', p.cpuBaseGhz ? `${p.cpuBaseGhz} GHz` : null],
        ['Maximum frequency', p.cpuMaxGhz ? `${p.cpuMaxGhz} GHz` : null],
        ['GPU manufacturer', p.gpuManufacturer],
        ['GPU model', p.gpuName],
        ['VRAM', p.vramGb ? `${p.vramGb} GB` : null],
        ['Memory bandwidth', p.memoryBandwidthGbps ? `${p.memoryBandwidthGbps} GB/s` : null],
        ['Compute capability', p.computeCapability],
        ['Installed RAM', `${p.ramGb} GiB`],
        ['Memory type', p.memoryType],
        ['Memory frequency', p.memoryFrequencyMhz ? `${p.memoryFrequencyMhz} MHz` : null],
      ]
    : [
        ['CPU cores / threads', `${p.physicalCores ?? '—'} / ${p.logicalProcessors ?? '—'}`],
        ['CPU base / max', `${p.cpuBaseGhz ?? '—'} / ${p.cpuMaxGhz ?? '—'} GHz`],
        ['Memory', `${p.ramGb} GiB${p.memoryType ? ` · ${p.memoryType}` : ''}`],
        ['VRAM', p.vramGb ? `${p.vramGb} GB` : null],
      ];
  return (
    <dl className={`hardware-specs ${full ? 'full-specs' : ''}`}>
      {rows.map(([label, value]) => (
        <div key={String(label)}>
          <dt>{label}</dt>
          <dd>{value || 'Not specified'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function HardwareLibrary({ user }: { user: CurrentUser }) {
  const client = useQueryClient();
  const auth = useAuth(user);
  const profiles = useQuery({
    queryKey: ['hardware-profiles', auth.data?.id],
    queryFn: () => apiData('/api/hardware-profiles', hardwareListSchema),
    enabled: !!auth.data,
    retry: false,
  });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<HardwareProfile>();
  const [deleting, setDeleting] = useState<HardwareProfile>();
  const [viewing, setViewing] = useState<HardwareProfile>();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [formGeneration, setFormGeneration] = useState(0);
  const formDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['hardware-profiles'] }),
      client.invalidateQueries({ queryKey: ['current-user'] }),
      client.invalidateQueries({ queryKey: ['hardware-connection'] }),
    ]);
  }
  const action = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: 'delete' | 'default' | 'select' }) => {
      await apiRequest(`/api/hardware-profiles/${id}${type === 'delete' ? '' : `/${type}`}`, {
        method: type === 'delete' ? 'DELETE' : 'POST',
      });
      await refresh();
      if (type === 'delete') deleteDialog.current?.close();
      setNotice(
        type === 'delete'
          ? 'Hardware profile deleted.'
          : type === 'default'
            ? 'Default hardware profile updated.'
            : 'Profile selected for future workload analysis.',
      );
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Unable to update profile.');
    },
  });
  function perform(id: string, type: 'delete' | 'default' | 'select') {
    setError('');
    setNotice('');
    action.mutate({ id, type });
  }
  function openForm(profile?: HardwareProfile) {
    setEditing(profile);
    setFormGeneration((value) => value + 1);
    setError('');
    formDialog.current?.showModal();
  }
  const all = profiles.data?.data ?? [];
  const visible = all.filter(
    (profile) =>
      `${profile.name} ${profile.cpuName} ${profile.gpuName ?? ''} ${profile.os} ${profile.manufacturer} ${profile.deviceModel}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (filter === 'all' || (filter === 'gpu' ? !!profile.gpuName : !profile.gpuName)),
  );
  const loading = auth.isPending || (!!auth.data && profiles.isPending);
  const failed = auth.error ?? profiles.error;
  return (
    <div className="dashboard hardware-library">
      <div className="page-heading">
        <div>
          <div className="eyebrow">YOUR COMPUTE ENVIRONMENTS</div>
          <h1>
            Hardware Library<span className="title-dot">.</span>
          </h1>
          <p>Every system, precisely documented. Your personal hardware collection.</p>
        </div>
        <Button onClick={() => openForm()} disabled={!auth.data}>
          <Plus size={16} />
          New profile
        </Button>
      </div>
      <div className="library-summary panel">
        <div className="library-summary-icon">
          <Cpu size={27} />
        </div>
        <div>
          <h2>Built around your hardware.</h2>
          <p>Save specifications once. Select the right environment for your next workload.</p>
        </div>
        <span className="library-count">
          <strong>{all.length}</strong>
          <span>{all.length === 1 ? 'PROFILE' : 'PROFILES'}</span>
        </span>
      </div>
      <div className="notice">
        <Monitor size={16} />
        <span>
          Manual specifications are <strong>USER_ENTERED</strong>. Imported properties are{' '}
          <strong>MEASURED</strong> runner-reported observations, not independent verification. This
          browser does not detect hardware.
        </span>
      </div>
      <div className="library-toolbar">
        <label className="library-search">
          <Search size={17} />
          <input
            type="search"
            aria-label="Search hardware profiles"
            placeholder="Search name, processor, graphics, or OS…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="library-filter">
          <span className="sr-only">Filter profiles</span>
          <select
            aria-label="Filter profiles"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All configurations</option>
            <option value="gpu">GPU specified</option>
            <option value="cpu">No GPU specified</option>
          </select>
        </label>
        <span>
          {visible.length} of {all.length} profiles
        </span>
      </div>
      {notice && (
        <div className="success-notice" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="hardware-grid" role="status" aria-label="Loading hardware profiles">
          {[0, 1, 2, 3].map((i) => (
            <div className="skeleton hardware-skeleton" key={i} />
          ))}
        </div>
      ) : failed ? (
        <section className="panel library-empty">
          <h2>Couldn’t load your library</h2>
          <p>{failed.message}</p>
          {failed instanceof ApiClientError && failed.status === 401 ? (
            <Button asChild>
              <Link href="/login?next=/hardware-library">Sign in again</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                void auth.refetch();
                void profiles.refetch();
              }}
            >
              Try again
            </Button>
          )}
        </section>
      ) : !auth.data ? (
        <section className="panel library-empty">
          <h2>Sign in to view your hardware</h2>
          <Button asChild>
            <Link href="/login?next=/hardware-library">Sign in</Link>
          </Button>
        </section>
      ) : !visible.length ? (
        <section className="panel library-empty">
          <span className="feature-icon">
            <Cpu size={34} />
          </span>
          <h2>
            {all.length ? 'No profiles match your search.' : 'Your hardware library starts here.'}
          </h2>
          <p>
            {all.length
              ? 'Try a different search or configuration filter.'
              : 'Add your first system to keep its CPU, GPU, and memory specifications in one private workspace.'}
          </p>
          <Button
            onClick={() => {
              if (all.length) {
                setSearch('');
                setFilter('all');
              } else openForm();
            }}
          >
            {all.length ? (
              'Clear filters'
            ) : (
              <>
                <Plus size={16} />
                Create your first profile
              </>
            )}
          </Button>
        </section>
      ) : (
        <div className="hardware-grid">
          {visible.map((profile) => {
            const isDefault = auth.data?.defaultProfileId === profile.id;
            const isSelected = auth.data?.selectedProfileId === profile.id;
            return (
              <article
                className={`panel hardware-card ${isSelected ? 'selected' : ''}`}
                key={profile.id}
                aria-label={profile.name}
              >
                <div className="hardware-card-top">
                  <span className="hardware-card-icon">
                    <Monitor size={23} />
                  </span>
                  <div className="hardware-card-title">
                    <h2>{profile.name}</h2>
                    <p>
                      {[profile.manufacturer, profile.deviceModel].filter(Boolean).join(' · ') ||
                        profile.os}
                    </p>
                  </div>
                  <button
                    className="icon-link"
                    title="View specifications"
                    aria-label={`View ${profile.name}`}
                    onClick={() => {
                      setViewing(profile);
                      detailDialog.current?.showModal();
                    }}
                  >
                    <Eye size={18} />
                  </button>
                </div>
                <div className="profile-badges">
                  <ProvenanceBadge value={profile.provenance} />
                  {isDefault && (
                    <span className="badge default-badge">
                      <Star size={10} />
                      DEFAULT
                    </span>
                  )}
                  {isSelected && (
                    <span className="badge selected-badge">
                      <Check size={10} />
                      SELECTED
                    </span>
                  )}
                </div>
                <div className="hardware-device">
                  <Cpu size={17} />
                  <div>
                    <small>PROCESSOR</small>
                    <strong>{profile.cpuName}</strong>
                  </div>
                </div>
                <div className="hardware-device gpu">
                  <Layers3 size={17} />
                  <div>
                    <small>GRAPHICS</small>
                    <strong>{profile.gpuName || 'Not specified'}</strong>
                  </div>
                </div>
                <Specs profile={profile} />
                <div className="hardware-os">
                  <MemoryStick size={13} />
                  <span>{profile.os}</span>
                </div>
                <div className="hardware-card-actions">
                  <Button
                    variant={isSelected ? 'outline' : 'default'}
                    disabled={action.isPending || isSelected}
                    onClick={() => perform(profile.id, 'select')}
                    aria-pressed={isSelected}
                  >
                    {isSelected ? (
                      <>
                        <Check size={14} />
                        Selected
                      </>
                    ) : (
                      <>
                        Select profile
                        <ArrowRight size={14} />
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={isDefault ? 'Default profile' : 'Make default'}
                    aria-label={
                      isDefault ? `${profile.name} is default` : `Make ${profile.name} default`
                    }
                    disabled={action.isPending || isDefault}
                    onClick={() => perform(profile.id, 'default')}
                  >
                    <Star size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${profile.name}`}
                    title="Edit profile"
                    onClick={() => openForm(profile)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${profile.name}`}
                    title="Delete profile"
                    onClick={() => {
                      setDeleting(profile);
                      setError('');
                      deleteDialog.current?.showModal();
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <dialog ref={formDialog} className="profile-dialog" aria-labelledby="profile-form-title">
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">HARDWARE PROFILE</span>
            <h2 id="profile-form-title">
              {editing ? 'Edit your system' : 'Add a compute environment'}
            </h2>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Close profile form"
            onClick={() => formDialog.current?.close()}
          >
            <X size={19} />
          </Button>
        </div>
        <HardwareForm
          key={formGeneration}
          profile={editing}
          onCancel={() => formDialog.current?.close()}
          onSave={async (input) => {
            await apiData(
              `/api/hardware-profiles${editing ? `/${editing.id}` : ''}`,
              hardwareResponseSchema,
              { method: editing ? 'PUT' : 'POST', body: JSON.stringify(input) },
            );
            await refresh();
            formDialog.current?.close();
            setNotice(editing ? 'Hardware profile updated.' : 'Hardware profile created.');
          }}
        />
      </dialog>
      <dialog ref={deleteDialog} className="confirm-dialog" aria-labelledby="delete-title">
        <div className="dialog-heading">
          <h2 id="delete-title">Delete hardware profile?</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close delete confirmation"
            onClick={() => deleteDialog.current?.close()}
          >
            <X size={18} />
          </Button>
        </div>
        <div className="confirm-body">
          <Trash2 size={28} />
          <p>
            <strong>{deleting?.name}</strong> will be permanently removed from your library. Its
            default or selected status will also be cleared.
          </p>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={action.isPending}
              onClick={() => deleteDialog.current?.close()}
            >
              Keep profile
            </Button>
            <Button
              disabled={action.isPending}
              onClick={() => deleting && perform(deleting.id, 'delete')}
            >
              {action.isPending ? 'Deleting…' : 'Delete profile'}
            </Button>
          </div>
        </div>
      </dialog>
      <dialog
        ref={detailDialog}
        className="profile-dialog detail-dialog"
        aria-labelledby="details-title"
      >
        <div className="dialog-heading">
          <div>
            <span className="eyebrow">SYSTEM SPECIFICATIONS</span>
            <h2 id="details-title">{viewing?.name}</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close specifications"
            onClick={() => detailDialog.current?.close()}
          >
            <X size={18} />
          </Button>
        </div>
        {viewing && (
          <div className="details-body">
            <ProvenanceBadge value={viewing.provenance} />
            <p className="details-description">
              {viewing.description || 'No description provided.'}
            </p>
            <Specs profile={viewing} full />
            <p className="details-footnote">
              Unknown specifications are shown as “Not specified”. User-entered data has not been
              measured or verified.
            </p>
          </div>
        )}
      </dialog>
    </div>
  );
}
