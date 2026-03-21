"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { AlertCircle, FileText, Globe, Loader2, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import type { KnowledgeDoc, StoredKnowledgeContext } from "@/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function statusBadge(doc: KnowledgeDoc) {
  if (doc.status === "ready") {
    return (
      <Badge className="bg-green-100 text-green-700">
        ✅ Ready · {doc.chunkCount ?? 0} chunks
      </Badge>
    );
  }
  if (doc.status === "error") {
    return (
      <Badge className="bg-red-100 text-red-700" title={doc.errorMsg ?? "Indexing failed"}>
        ❌ Error
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-700">
      <Loader2 className="mr-1 size-3 animate-spin" />
      Indexing...
    </Badge>
  );
}

function docLabel(doc: KnowledgeDoc): string {
  return doc.filename || doc.sourceUrl || "Untitled document";
}

export default function KnowledgePage() {
  const { data: baseDocs = [], mutate: mutateDocs } = useSWR("knowledge-docs", () => api.knowledge.list());
  const { data: storedContext, mutate: mutateContext } = useSWR<StoredKnowledgeContext | null>(
    "knowledge-context",
    () => api.knowledge.getContext()
  );
  const { data: agents = [] } = useSWR("agents", () => api.agents.list());
  const [localDocs, setLocalDocs] = useState<KnowledgeDoc[]>([]);
  const [url, setUrl] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const docs = useMemo(() => {
    const byId = new Map<string, KnowledgeDoc>();
    [...baseDocs, ...localDocs]
      .filter((doc) => {
        const id = doc.id || (doc as { _id?: string })._id || "";
        return id && !deletedIds.has(id);
      })
      .forEach((doc) => {
        const id = doc.id || (doc as { _id?: string })._id || "";
        if (id) byId.set(id, { ...doc, id });
      });
    return Array.from(byId.values());
  }, [baseDocs, localDocs, deletedIds]);

  const handleDelete = async (docId: string) => {
    if (!docId) return;
    try {
      setDeletedIds((prev) => new Set(prev).add(docId));
      await api.knowledge.delete(docId);
      setLocalDocs((prev) => prev.filter((d) => d.id !== docId));
      void mutateDocs();
      toast.success("Document deleted");
    } catch (error) {
      setDeletedIds((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
      const message = error instanceof Error ? error.message : "Delete failed";
      toast.error(message);
    }
  };

  const handleGenerateContext = async () => {
    setIsGeneratingContext(true);
    try {
      const result = await api.knowledge.generateContext("support");
      if (result.context?.generatedAt) {
        await mutateContext();
      }
      toast.success("Context generated successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generate context failed";
      toast.error(message);
    } finally {
      setIsGeneratingContext(false);
    }
  };

  useEffect(() => {
    const pendingIds = docs
      .filter((doc) => doc.status === "pending" || doc.status === "processing")
      .map((doc) => doc.id)
      .filter((id): id is string => Boolean(id && id !== "undefined"));
    if (pendingIds.length === 0) return;

    const timer = setInterval(async () => {
      const updates = await Promise.all(
        pendingIds.map(async (id) => {
          try {
            const status = await api.knowledge.status(id);
            return { ...status, id: status.id || id };
          } catch {
            return null;
          }
        })
      );
      setLocalDocs((prev) => {
        const merged = new Map(prev.map((d) => [d.id, d]));
        updates.filter(Boolean).forEach((d) => merged.set((d as KnowledgeDoc).id, d as KnowledgeDoc));
        return Array.from(merged.values());
      });
      void mutateDocs();
    }, 3000);

    return () => clearInterval(timer);
  }, [docs, mutateDocs]);

  const onDrop = async (files: File[]) => {
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await api.knowledge.upload(formData);
        setLocalDocs((prev) => [
          ...prev,
          {
            id: res.docId,
            type: "txt",
            filename: file.name,
            status: (res.status === "ready" ? "ready" : "pending") as KnowledgeDoc["status"],
          },
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        toast.error(message);
      }
    }
  };

  const dropzone = useDropzone({
    onDrop,
    maxSize: 10 * 1024 * 1024,
    multiple: true,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
  });

  const onScrape = async () => {
    if (!url.trim()) return;
    setIsScraping(true);
    try {
      const res = await api.knowledge.scrape(url.trim());
      setLocalDocs((prev) => [
        ...prev,
        {
          id: res.docId,
          type: "scrape",
          sourceUrl: url.trim(),
          status: (res.status === "ready" ? "ready" : "pending") as KnowledgeDoc["status"],
        },
      ]);
      setUrl("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scrape failed";
      toast.error(message);
    } finally {
      setIsScraping(false);
    }
  };

  const totalChunks = docs.reduce((sum, doc) => sum + (doc.chunkCount ?? 0), 0);

  return (
    <div className="space-y-5 p-6">
      <Card className="border-indigo-200 bg-indigo-50/50">
        <CardContent className="pt-4 text-sm text-indigo-900">
          <p className="font-medium">
            📌 Upload your documents here BEFORE creating an agent. The AI will read all your documents when you
            create an agent and generate a smart knowledge file automatically.
          </p>
          {agents.length > 0 && (
            <p className="mt-2 text-indigo-800">
              Have new documents? Upload them here, then go to your agent and click &quot;Regenerate Context&quot;.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            {...dropzone.getRootProps()}
            className="cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center"
          >
            <input {...dropzone.getInputProps()} />
            <p className="font-medium">Drop PDF, DOCX, or TXT files here</p>
            <p className="text-sm text-slate-600">Max 10MB per file · 5 credits per file</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Web Scrape</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/docs"
            />
            <Button onClick={onScrape} disabled={isScraping}>
              Scrape
            </Button>
          </div>
          <p className="text-sm text-slate-600">2 credits per URL</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stats</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
          <span>{docs.length} documents · {totalChunks} chunks indexed · ready for AI agents</span>
          <Button
            onClick={handleGenerateContext}
            disabled={docs.length === 0 || isGeneratingContext}
          >
            {isGeneratingContext ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Get Context"
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!storedContext ? (
            <p className="text-sm text-slate-500">
              No context generated yet. Click &quot;Get Context&quot; to create and store it in MongoDB.
            </p>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Last generated: {new Date(storedContext.generatedAt).toLocaleString()}
              </p>
              <pre className="max-h-64 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
                {JSON.stringify(storedContext.knowledgeFile, null, 2)}
              </pre>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {docs.length === 0 ? (
            <p className="text-sm text-slate-500">No documents yet.</p>
          ) : (
            docs.map((doc, index) => (
              <div
                key={doc.id || (doc as { _id?: string })._id || `doc-${index}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate font-medium">
                    {doc.type === "scrape" ? <Globe className="size-4" /> : <FileText className="size-4" />}
                    {docLabel(doc)}
                  </p>
                  <p className="text-xs text-slate-500">{doc.type?.toUpperCase() ?? "DOC"} · Indexed document</p>
                  {doc.status === "error" && doc.errorMsg && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-red-600" title={doc.errorMsg}>
                      <AlertCircle className="size-3" />
                      {doc.errorMsg}
                    </p>
                  )}
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  {statusBadge(doc)}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50 hover:text-red-700">
                        <Trash2 className="size-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete document?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently remove &quot;{docLabel(doc)}&quot; from R2 and MongoDB.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(doc.id ?? (doc as { _id?: string })._id ?? "")}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
