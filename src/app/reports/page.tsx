'use client'

import Link from 'next/link'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Calendar,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  GitCompareArrows,
  HardDrive,
  Layers3,
  Search,
  Trees,
  X,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { useAnalysisStore } from '@/hooks/useAnalysisStore'
import { STATUS_LABELS, SUPPORTED_FORMATS, SPECIES_OPTIONS } from '@/lib/constants'
import { downloadVariantsCsv, printAnalysisReport } from '@/lib/exporters'
import { analysisService } from '@/services/analysisService'
import { genomeApi } from '@/services/genomeApi'
import type {
  AnalysisSummary,
  ReportFilters,
  RunComparisonSummary,
  UploadAnalysisResult,
} from '@/types/genome'

const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const initialFilters: ReportFilters = {
  search: '',
  speciesId: 'all',
  status: 'all',
  format: 'all',
}

export default function ReportsPage() {
  const { reports, analysesById, isLoading, error, fetchReports } = useAnalysisStore()
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [filters, setFilters] = useState<ReportFilters>(initialFilters)
  const deferredSearch = useDeferredValue(filters.search ?? '')
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [comparisonResults, setComparisonResults] = useState<UploadAnalysisResult[]>([])
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [comparisonError, setComparisonError] = useState<string | null>(null)

  useEffect(() => {
    if (!reports.length) {
      void fetchReports()
    }
  }, [fetchReports, reports.length])

  const getReportResult = useCallback(
    async (report: AnalysisSummary): Promise<UploadAnalysisResult | null> => {
      if (analysesById[report.id]) {
        return analysesById[report.id]
      }

      return genomeApi.getAnalysisResult(report.id)
    },
    [analysesById],
  )

  const filteredReports = useMemo(
    () =>
      analysisService.filterReports(reports, {
        ...filters,
        search: deferredSearch,
      }),
    [deferredSearch, filters, reports],
  )
  const completedReports = filteredReports.filter((report) => report.status === 'completed')
  const queuedReports = filteredReports.filter(
    (report) => report.status === 'queued' || report.status === 'processing',
  )
  const storageUsedGb = useMemo(
    () => filteredReports.reduce((sum, report) => sum + report.fileSizeMb, 0) / 1024,
    [filteredReports],
  )
  const averageDepth = useMemo(() => {
    if (!completedReports.length) {
      return 0
    }

    return (
      completedReports.reduce((sum, report) => sum + report.meanDepth, 0) /
      completedReports.length
    )
  }, [completedReports])

  const latestCompletedReport = completedReports[0] ?? null
  const selectedReports = useMemo(
    () =>
      compareIds
        .map((id) => reports.find((report) => report.id === id))
        .filter(Boolean) as AnalysisSummary[],
    [compareIds, reports],
  )

  useEffect(() => {
    setCompareIds((current) =>
      current.filter((id) =>
        reports.some((report) => report.id === id && report.status === 'completed'),
      ),
    )
  }, [reports])

  useEffect(() => {
    let cancelled = false

    if (compareIds.length !== 2) {
      setComparisonResults([])
      setComparisonLoading(false)
      setComparisonError(null)
      return
    }

    const runsToCompare = compareIds
      .map((id) => reports.find((report) => report.id === id))
      .filter(Boolean) as AnalysisSummary[]

    if (runsToCompare.length !== 2) {
      setComparisonResults([])
      setComparisonError('Не удалось найти два selected run для сравнения.')
      return
    }

    setComparisonLoading(true)
    setComparisonError(null)

    void Promise.all(runsToCompare.map((report) => getReportResult(report)))
      .then((results) => {
        if (cancelled) {
          return
        }

        if (results.some((result) => !result)) {
          setComparisonResults([])
          setComparisonError('Не удалось загрузить оба результата для сравнения.')
          return
        }

        setComparisonResults(results as UploadAnalysisResult[])
      })
      .catch(() => {
        if (!cancelled) {
          setComparisonResults([])
          setComparisonError('Сравнение не удалось загрузить.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setComparisonLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [compareIds, getReportResult, reports])

  const comparisonSummary = useMemo<RunComparisonSummary | null>(() => {
    if (comparisonResults.length !== 2) {
      return null
    }

    return analysisService.compareRuns(
      comparisonResults[0].summary,
      comparisonResults[1].summary,
      comparisonResults[0].variants,
      comparisonResults[1].variants,
    )
  }, [comparisonResults])

  const exportCsv = async (report: AnalysisSummary) => {
    setExportingId(report.id)

    try {
      const result = await getReportResult(report)
      if (result) {
        downloadVariantsCsv(report, result.variants)
      }
    } finally {
      setExportingId(null)
    }
  }

  const exportPdf = async (report: AnalysisSummary) => {
    setExportingId(report.id)

    try {
      const result = await getReportResult(report)
      if (result) {
        printAnalysisReport(report, result.variants)
      }
    } finally {
      setExportingId(null)
    }
  }

  const toggleCompare = (report: AnalysisSummary) => {
    if (report.status !== 'completed') {
      return
    }

    setCompareIds((current) => {
      if (current.includes(report.id)) {
        return current.filter((id) => id !== report.id)
      }

      if (current.length < 2) {
        return [...current, report.id]
      }

      return [current[1], report.id]
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="outline">Reports archive</Badge>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
              История plant reports
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Фильтруйте архив по species/status/format и сравнивайте два completed run по
              coverage и variant overlap.
            </p>
          </div>
          <Button asChild>
            <Link href="/upload">
              <Layers3 className="mr-2 h-4 w-4" />
              Новый анализ
            </Link>
          </Button>
        </div>

        <section className="grid gap-4 md:grid-cols-3">
          <ReportMetric
            title="Completed"
            value={`${completedReports.length}`}
            helper="В текущей выборке"
          />
          <ReportMetric
            title="Queued"
            value={`${queuedReports.length}`}
            helper="Ожидают backend pipeline"
          />
          <ReportMetric
            title="Avg depth"
            value={`${averageDepth.toFixed(1)}`}
            helper="По completed runs"
          />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Фильтры архива</CardTitle>
            <CardDescription>
              Поиск по file name, run ID, focus gene и статусу, плюс узкие фильтры по
              species, status и format.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 xl:grid-cols-[1fr_220px_180px_180px_140px]">
              <label className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={filters.search ?? ''}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="run ID, file, focus gene, status"
                  className="w-full rounded-2xl border border-genome-border bg-muted/40 py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors focus:border-primary"
                />
              </label>

              <select
                value={filters.speciesId ?? 'all'}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    speciesId: event.target.value as ReportFilters['speciesId'],
                  }))
                }
                className="rounded-2xl border border-genome-border bg-muted/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-primary"
              >
                <option value="all">Все species</option>
                {SPECIES_OPTIONS.map((species) => (
                  <option key={species.id} value={species.id}>
                    {species.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.status ?? 'all'}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value as ReportFilters['status'],
                  }))
                }
                className="rounded-2xl border border-genome-border bg-muted/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-primary"
              >
                <option value="all">Все статусы</option>
                {Object.entries(STATUS_LABELS).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={filters.format ?? 'all'}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    format: event.target.value as ReportFilters['format'],
                  }))
                }
                className="rounded-2xl border border-genome-border bg-muted/40 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-primary"
              >
                <option value="all">Все форматы</option>
                {SUPPORTED_FORMATS.map((format) => (
                  <option key={format.label} value={format.label}>
                    {format.label}
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                onClick={() => setFilters(initialFilters)}
                disabled={
                  !filters.search &&
                  (filters.speciesId ?? 'all') === 'all' &&
                  (filters.status ?? 'all') === 'all' &&
                  (filters.format ?? 'all') === 'all'
                }
              >
                Сбросить
              </Button>
            </div>

            <p className="text-sm text-slate-500">
              Показано {filteredReports.length} из {reports.length} runs. Для сравнения выберите
              два completed run.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Список запусков</CardTitle>
            <CardDescription>
              Открывайте dashboard, выгружайте CSV/PDF и собирайте пару runs для compare mode.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && !reports.length ? (
              <div className="flex items-center gap-3 py-8 text-sm text-slate-400">
                <Spinner className="h-5 w-5" />
                Загрузка архива отчётов...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Run</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead>Species</TableHead>
                    <TableHead>Focus gene</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.length ? (
                    filteredReports.map((report) => {
                      const isSelectedForCompare = compareIds.includes(report.id)

                      return (
                        <TableRow key={report.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-semibold text-white">{report.fileName}</span>
                              <span className="text-xs text-slate-500">{report.id}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <Calendar className="h-3.5 w-3.5" />
                              {dateFormatter.format(new Date(report.date))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {report.speciesId} · {report.assemblyId}
                            </Badge>
                          </TableCell>
                          <TableCell>{report.focusGene}</TableCell>
                          <TableCell>{renderStatus(report.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button asChild variant="ghost" size="icon" title="Открыть дашборд">
                                <Link href={`/dashboard?id=${report.id}`}>
                                  <ExternalLink className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button
                                variant={isSelectedForCompare ? 'secondary' : 'outline'}
                                size="sm"
                                onClick={() => toggleCompare(report)}
                                disabled={report.status !== 'completed' && !isSelectedForCompare}
                                title={
                                  report.status === 'completed'
                                    ? 'Добавить в compare mode'
                                    : 'Сравнение доступно только для completed runs'
                                }
                              >
                                <GitCompareArrows className="mr-2 h-4 w-4" />
                                {isSelectedForCompare ? 'Выбран' : 'Compare'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Скачать CSV"
                                onClick={() => void exportCsv(report)}
                                disabled={exportingId === report.id || report.status !== 'completed'}
                              >
                                {exportingId === report.id ? (
                                  <Spinner className="h-4 w-4" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Печатный PDF"
                                onClick={() => void exportPdf(report)}
                                disabled={exportingId === report.id || report.status !== 'completed'}
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-slate-500">
                        Под текущие фильтры runs не найдены.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
            {error ? (
              <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <RunComparisonCard
          selectedReports={selectedReports}
          comparisonResults={comparisonResults}
          comparisonSummary={comparisonSummary}
          isLoading={comparisonLoading}
          error={comparisonError}
          onClear={() => setCompareIds([])}
        />

        <Card>
          <CardHeader>
            <CardTitle>Хранилище</CardTitle>
            <CardDescription>
              Реальная оценка локального persistent архива запусков.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-2xl border border-genome-border bg-muted/40 p-4">
              <HardDrive className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-semibold text-white">{storageUsedGb.toFixed(1)} GB</p>
                <p className="text-sm text-slate-400">Суммарный размер текущей выборки</p>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-genome-border">
              <div
                className="h-full rounded-full genome-gradient"
                style={{ width: `${Math.min(100, (storageUsedGb / 50) * 100)}%` }}
              />
            </div>
            <p className="text-sm leading-6 text-slate-400">
              Архив строится из локального `.phyto/` workspace. С фильтрами выше этот блок
              помогает быстро оценить вес выбранного подмножества runs.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Последний completed run</CardTitle>
            <CardDescription>
              Быстрый доступ к самому свежему completed analysis в текущей выборке.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {latestCompletedReport ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-genome-border bg-muted/40 p-4">
                  <div className="flex items-center gap-2">
                    <Trees className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-white">
                      {latestCompletedReport.fileName}
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    {latestCompletedReport.speciesId} · {latestCompletedReport.focusGene} ·{' '}
                    {latestCompletedReport.highImpactVariants} high-impact variants
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button asChild className="flex-1">
                    <Link href={`/dashboard?id=${latestCompletedReport.id}`}>
                      Открыть dashboard
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => void exportPdf(latestCompletedReport)}
                    disabled={exportingId === latestCompletedReport.id}
                  >
                    PDF
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                В текущей фильтрации completed runs отсутствуют.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ReportMetric({
  title,
  value,
  helper,
}: {
  title: string
  value: string
  helper: string
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm text-slate-400">{title}</p>
        <p className="mt-2 text-3xl font-bold text-white">{value}</p>
        <p className="mt-2 text-sm text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  )
}

function RunComparisonCard({
  selectedReports,
  comparisonResults,
  comparisonSummary,
  isLoading,
  error,
  onClear,
}: {
  selectedReports: AnalysisSummary[]
  comparisonResults: UploadAnalysisResult[]
  comparisonSummary: RunComparisonSummary | null
  isLoading: boolean
  error: string | null
  onClear: () => void
}) {
  const [leftResult, rightResult] = comparisonResults

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Сравнение runs</CardTitle>
            <CardDescription>
              Выберите два completed run, чтобы сравнить variant overlap, unique genes и
              ключевые summary metrics.
            </CardDescription>
          </div>
          {selectedReports.length ? (
            <Button variant="ghost" size="sm" onClick={onClear}>
              <X className="mr-2 h-4 w-4" />
              Очистить
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedReports.length === 0 ? (
          <EmptyPanel message="Сейчас compare mode пуст. Выберите два completed run из таблицы слева." />
        ) : null}

        {selectedReports.length === 1 ? (
          <div className="space-y-4">
            <SelectedRunCard report={selectedReports[0]} />
            <EmptyPanel message="Нужен ещё один completed run, чтобы посчитать overlap и delta." />
          </div>
        ) : null}

        {isLoading ? (
          <div className="flex items-center gap-3 py-6 text-sm text-slate-400">
            <Spinner className="h-5 w-5" />
            Подгружаю оба run для compare mode...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {selectedReports.length === 2 && !isLoading && !error && comparisonSummary ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {leftResult ? <ComparisonRunCard result={leftResult} side="A" /> : null}
              {rightResult ? <ComparisonRunCard result={rightResult} side="B" /> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ComparisonMetric
                title="Shared variants"
                value={`${comparisonSummary.sharedVariantCount}`}
                helper="Совпадающие genomic events"
              />
              <ComparisonMetric
                title="Shared genes"
                value={`${comparisonSummary.sharedGeneCount}`}
                helper="Общие затронутые гены"
              />
              <ComparisonMetric
                title="A-only variants"
                value={`${comparisonSummary.leftOnlyVariantCount}`}
                helper="Уникальные для run A"
              />
              <ComparisonMetric
                title="B-only variants"
                value={`${comparisonSummary.rightOnlyVariantCount}`}
                helper="Уникальные для run B"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <DeltaCard
                title="Delta metrics"
                lines={[
                  `Variant count: ${formatSignedDelta(comparisonSummary.variantCountDelta)}`,
                  `High impact: ${formatSignedDelta(comparisonSummary.highImpactDelta)}`,
                  `Mean depth: ${formatSignedDelta(comparisonSummary.meanDepthDelta)}`,
                  `Mean quality: ${formatSignedDelta(comparisonSummary.meanQualityDelta)}`,
                ]}
              />
              <DeltaCard
                title="Gene overlap"
                lines={[
                  `Shared genes: ${comparisonSummary.sharedGeneCount}`,
                  `A only: ${comparisonSummary.leftOnlyGeneCount}`,
                  `B only: ${comparisonSummary.rightOnlyGeneCount}`,
                ]}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <GeneBucket title="Shared genes" genes={comparisonSummary.sharedGenes} />
              <GeneBucket title="A-only genes" genes={comparisonSummary.leftOnlyGenes} />
              <GeneBucket title="B-only genes" genes={comparisonSummary.rightOnlyGenes} />
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function SelectedRunCard({ report }: { report: AnalysisSummary }) {
  return (
    <div className="rounded-2xl border border-genome-border bg-muted/40 p-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">Selected</Badge>
        <p className="text-sm font-semibold text-white">{report.fileName}</p>
      </div>
      <p className="mt-2 text-sm text-slate-400">
        {report.id} · {report.speciesId} · {report.focusGene}
      </p>
    </div>
  )
}

function ComparisonRunCard({
  result,
  side,
}: {
  result: UploadAnalysisResult
  side: 'A' | 'B'
}) {
  const report = result.summary

  return (
    <div className="rounded-2xl border border-genome-border bg-muted/40 p-4">
      <div className="flex items-center gap-2">
        <Badge variant={side === 'A' ? 'secondary' : 'outline'}>Run {side}</Badge>
        <p className="text-sm font-semibold text-white">{report.fileName}</p>
      </div>
      <p className="mt-2 text-xs text-slate-500">{report.id}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ComparisonField label="Species" value={`${report.speciesId} · ${report.assemblyId}`} />
        <ComparisonField label="Format" value={report.format} />
        <ComparisonField label="Focus gene" value={report.focusGene} />
        <ComparisonField label="Variants" value={`${report.variantCount}`} />
        <ComparisonField label="High impact" value={`${report.highImpactVariants}`} />
        <ComparisonField label="Mean depth" value={`${report.meanDepth.toFixed(1)}`} />
      </div>
    </div>
  )
}

function ComparisonField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  )
}

function ComparisonMetric({
  title,
  value,
  helper,
}: {
  title: string
  value: string
  helper: string
}) {
  return (
    <div className="rounded-2xl border border-genome-border bg-muted/40 p-4">
      <p className="text-sm text-slate-400">{title}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{helper}</p>
    </div>
  )
}

function DeltaCard({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-2xl border border-genome-border bg-muted/40 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-4 space-y-2">
        {lines.map((line) => (
          <p key={line} className="text-sm text-slate-400">
            {line}
          </p>
        ))}
      </div>
    </div>
  )
}

function GeneBucket({ title, genes }: { title: string; genes: string[] }) {
  return (
    <div className="rounded-2xl border border-genome-border bg-muted/40 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      {genes.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {genes.slice(0, 8).map((gene) => (
            <Badge key={gene} variant="outline">
              {gene}
            </Badge>
          ))}
          {genes.length > 8 ? (
            <Badge variant="outline">+{genes.length - 8}</Badge>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">Нет элементов.</p>
      )}
    </div>
  )
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex min-h-28 items-center justify-center rounded-3xl border border-dashed border-genome-border bg-muted/30 px-4 text-center text-sm text-slate-500">
      {message}
    </div>
  )
}

function formatSignedDelta(value: number) {
  if (value > 0) {
    return `+${value}`
  }

  return `${value}`
}

function renderStatus(status: AnalysisSummary['status']) {
  if (status === 'completed') {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-400">
        <CheckCircle2 className="h-4 w-4" />
        Завершён
      </div>
    )
  }

  if (status === 'processing') {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-400">
        <Clock3 className="h-4 w-4" />
        В обработке
      </div>
    )
  }

  if (status === 'queued') {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-400">
        <Clock3 className="h-4 w-4" />
        В очереди
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm text-rose-400">
      <XCircle className="h-4 w-4" />
      С ошибкой
    </div>
  )
}
