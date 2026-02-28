"use client";

import { Copy, Download, ExternalLink, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getShareUrl } from "@/lib/demo-loader";

interface ExportModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	evaluationName: string;
	onExport: (options: ExportOptions) => Promise<string | null>; // Returns share ID if published
}

export interface ExportOptions {
	publishAsDemo: boolean;
	customShareId?: string;
	shareScope?: "evaluation" | "run";
}

export function ExportModal({
	open,
	onOpenChange,
	evaluationName: _evaluationName,
	onExport,
}: ExportModalProps) {
	const [publishAsDemo, setPublishAsDemo] = useState(false);
	const [customShareId, setCustomShareId] = useState("");
	const [isExporting, setIsExporting] = useState(false);
	const [_shareId, setShareId] = useState<string | null>(null);
	const [shareUrl, setShareUrl] = useState<string | null>(null);

	const handleExport = async () => {
		setIsExporting(true);
		try {
			const resultShareId = await onExport({
				publishAsDemo,
				customShareId: customShareId.trim() || undefined,
			});

			if (resultShareId && publishAsDemo) {
				setShareId(resultShareId);
				const url = getShareUrl(resultShareId);
				setShareUrl(url);
				toast.success("Exported and published!", {
					description: "Your evaluation is now publicly accessible",
				});
			} else {
				toast.success("Exported successfully!");
				onOpenChange(false);
			}
		} catch (error) {
			toast.error("Export failed", {
				description: error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setIsExporting(false);
		}
	};

	const handleCopyShareUrl = () => {
		if (shareUrl) {
			navigator.clipboard.writeText(shareUrl);
			toast.success("Share link copied!");
		}
	};

	const handleOpenShareUrl = () => {
		if (shareUrl) {
			window.open(shareUrl, "_blank");
		}
	};

	const handleClose = () => {
		setPublishAsDemo(false);
		setCustomShareId("");
		setShareId(null);
		setShareUrl(null);
		onOpenChange(false);
	};

	// If we have a share URL, show the success state
	if (shareUrl) {
		return (
			<Dialog open={open} onOpenChange={handleClose}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Share2 className="h-5 w-5 text-green-600" />
							Evaluation Published!
						</DialogTitle>
						<DialogDescription>
							Your evaluation is now publicly accessible. Share this link with
							unknownone.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="flex items-center space-x-2">
							<Input readOnly value={shareUrl} className="flex-1" />
							<Button
								type="button"
								size="icon"
								variant="outline"
								onClick={handleCopyShareUrl}
							>
								<Copy className="h-4 w-4" />
							</Button>
						</div>

						<div className="flex gap-2">
							<Button onClick={handleOpenShareUrl} className="flex-1">
								<ExternalLink className="mr-2 h-4 w-4" />
								Open Share Page
							</Button>
							<Button
								variant="outline"
								onClick={handleClose}
								className="flex-1"
							>
								Done
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Export Evaluation</DialogTitle>
					<DialogDescription>
						Download your evaluation results as JSON. Optionally publish as a
						public demo.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-4">
					<div className="space-y-2">
						<Label className="text-base font-medium">Export Options</Label>
						<div className="flex items-start space-x-2">
							<Checkbox
								id="publish-demo"
								checked={publishAsDemo}
								onCheckedChange={(checked) =>
									setPublishAsDemo(checked as boolean)
								}
							/>
							<div className="grid gap-1.5 leading-none">
								<label
									htmlFor="publish-demo"
									className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
								>
									Make this export public as demo
								</label>
								<p className="text-sm text-muted-foreground">
									unknownone with the link can view this evaluation
								</p>
							</div>
						</div>
					</div>

					{publishAsDemo && (
						<div className="space-y-2">
							<Label htmlFor="share-id">Custom Share ID (optional)</Label>
							<Input
								id="share-id"
								placeholder="e.g., my-chatbot-eval"
								value={customShareId}
								onChange={(e) =>
									setCustomShareId(
										e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
									)
								}
							/>
							<p className="text-xs text-muted-foreground">
								Leave blank for auto-generated ID. Use lowercase letters,
								numbers, and hyphens only.
							</p>
						</div>
					)}

					<div className="rounded-lg bg-muted p-3 space-y-1">
						<p className="text-sm font-medium">What will be exported:</p>
						<ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
							<li>Evaluation metadata and configuration</li>
							<li>Quality scores and metrics</li>
							<li>Test results and detailed data</li>
							<li>Insights and recommendations</li>
						</ul>
					</div>
				</div>

				<DialogFooter className="flex-col sm:flex-row gap-2">
					<Button
						variant="outline"
						onClick={handleClose}
						disabled={isExporting}
						className="w-full sm:w-auto"
					>
						Cancel
					</Button>
					<Button
						onClick={handleExport}
						disabled={isExporting}
						className="w-full sm:w-auto"
					>
						{isExporting ? (
							<>
								<div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
								Exporting...
							</>
						) : (
							<>
								<Download className="mr-2 h-4 w-4" />
								{publishAsDemo ? "Export & Publish" : "Export"}
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
