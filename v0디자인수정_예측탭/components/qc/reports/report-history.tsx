"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Eye, FileText, Calendar } from "lucide-react"

interface ReportHistoryItem {
  id: string
  type: "weekly" | "monthly"
  period: string
  center: string
  generatedAt: string
  generatedBy: string
}

interface ReportHistoryProps {
  reports: ReportHistoryItem[]
  onView: (report: ReportHistoryItem) => void
  onDownload: (report: ReportHistoryItem) => void
}

export function ReportHistory({ reports, onView, onDownload }: ReportHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-5 w-5" />
          생성 이력
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>유형</TableHead>
              <TableHead>기간</TableHead>
              <TableHead>센터</TableHead>
              <TableHead>생성일시</TableHead>
              <TableHead>생성자</TableHead>
              <TableHead className="w-[100px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell>
                  <Badge variant={report.type === "weekly" ? "default" : "secondary"}>
                    <FileText className="mr-1 h-3 w-3" />
                    {report.type === "weekly" ? "주간" : "월간"}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">{report.period}</TableCell>
                <TableCell>{report.center === "all" ? "전체" : report.center}</TableCell>
                <TableCell className="text-muted-foreground">{report.generatedAt}</TableCell>
                <TableCell className="text-muted-foreground">{report.generatedBy}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onView(report)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDownload(report)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
