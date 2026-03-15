'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Search } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Plant genomics workspace',
    subtitle:
      'Dual-mode platform for Arabidopsis-first research and species-generic exploration.',
  },
  '/workbench': {
    title: 'Research workbench',
    subtitle:
      'Search by AGI, symbol, locus or variant and aggregate evidence in one view.',
  },
  '/upload': {
    title: 'Upload pipeline',
    subtitle:
      'Plant-aware upload flow with focus gene, variant context and downstream evidence.',
  },
  '/dashboard': {
    title: 'Upload-driven dashboard',
    subtitle:
      'Unified research view anchored on the current uploaded analysis.',
  },
  '/reports': {
    title: 'Run archive',
    subtitle: 'History of completed and processing plant genomics analyses.',
  },
  '/literature': {
    title: 'Literature workspace',
    subtitle:
      'Search, filter, and rank Europe PMC evidence around the current plant genomics query.',
  },
}

export const Header = () => {
  const pathname = usePathname()
  const meta = pageMeta[pathname] ?? pageMeta['/']

  return (
    <header className="border-genome-border bg-genome-bg/75 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="genome-gradient shadow-primary/20 flex h-10 w-10 items-center justify-center rounded-2xl shadow-lg lg:hidden">
            <div className="h-4 w-4 rotate-45 rounded-sm border-2 border-white/90" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.24em] text-slate-500 uppercase">
              PhytoScope workspace
            </p>
            <h1 className="truncate text-sm font-semibold text-white md:text-base">
              {meta.title}
            </h1>
          </div>
        </div>

        <div
          className="border-genome-border bg-genome-card/70 hidden min-w-0 flex-1 items-center gap-3 rounded-2xl border px-4 py-2 xl:flex xl:max-w-xl"
          aria-live="polite"
        >
          <Search
            size={18}
            className="shrink-0 text-slate-500"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-[11px] tracking-[0.2em] text-slate-500 uppercase">
              Контекст страницы
            </p>
            <p className="truncate text-sm text-slate-300">{meta.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <Badge variant="success" className="hidden md:inline-flex">
            Arabidopsis-first
          </Badge>
          <Tooltip content="Новых системных оповещений нет">
            <button
              type="button"
              className="border-genome-border bg-genome-card/70 rounded-full border p-2 text-slate-400 transition-colors hover:text-white"
              aria-label="Уведомления"
            >
              <Bell size={18} />
            </button>
          </Tooltip>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/workbench">Новый поиск</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
