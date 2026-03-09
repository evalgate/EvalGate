"use client";

import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface Candidate {
	candidateId: string;
	failureMode: string;
	quality: number;
	confidence: number;
	detectors: number;
	status: "quarantined" | "approved" | "promoted" | "rejected";
	input: string;
	expected: string;
	actual: string;
	createdAt: string;
}

interface RejectDialogProps {
	candidate: Candidate;
	onReject: (candidateId: string, reason: string) => void;
	isOpen: boolean;
	onClose: () => void;
}

function RejectDialog({
	candidate,
	onReject,
	isOpen,
	onClose,
}: RejectDialogProps) {
	const [reason, setReason] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async () => {
		if (!reason.trim()) {
			toast.error("Please provide a reason for rejection");
			return;
		}

		setIsSubmitting(true);
		try {
			await onReject(candidate.candidateId, reason);
			setReason("");
			onClose();
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Reject Candidate</DialogTitle>
					<DialogDescription>
						Reject candidate {candidate.candidateId} for failure mode "
						{candidate.failureMode}". This action cannot be undone.
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<Label htmlFor="reason">Reason for rejection</Label>
						<Textarea
							id="reason"
							placeholder="Explain why this candidate is being rejected..."
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							className="mt-1"
						/>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={isSubmitting}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={handleSubmit}
						disabled={isSubmitting}
					>
						{isSubmitting ? "Rejecting..." : "Reject Candidate"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function StatusBadge({ status }: { status: Candidate["status"] }) {
	switch (status) {
		case "quarantined":
			return (
				<Badge variant="secondary">
					<Clock className="w-3 h-3 mr-1" />
					Quarantined
				</Badge>
			);
		case "approved":
			return (
				<Badge variant="default">
					<CheckCircle className="w-3 h-3 mr-1" />
					Approved
				</Badge>
			);
		case "promoted":
			return (
				<Badge variant="default" className="bg-green-600">
					<CheckCircle className="w-3 h-3 mr-1" />
					Promoted
				</Badge>
			);
		case "rejected":
			return (
				<Badge variant="destructive">
					<XCircle className="w-3 h-3 mr-1" />
					Rejected
				</Badge>
			);
		default:
			return <Badge variant="outline">{status}</Badge>;
	}
}

function AutoPromoteIndicator({ candidate }: { candidate: Candidate }) {
	const isEligible =
		candidate.quality >= 90 &&
		candidate.confidence >= 0.8 &&
		candidate.detectors >= 2;

	if (!isEligible) return null;

	return (
		<Badge variant="outline" className="border-green-500 text-green-700">
			<AlertCircle className="w-3 h-3 mr-1" />
			Auto-promote eligible
		</Badge>
	);
}

export function CandidatesClient() {
	const [candidates, setCandidates] = useState<Candidate[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedFailureMode, setSelectedFailureMode] = useState<string>("all");
	const [rejectDialog, setRejectDialog] = useState<{
		isOpen: boolean;
		candidate: Candidate | null;
	}>({ isOpen: false, candidate: null });

	const fetchCandidates = useCallback(async () => {
		try {
			setLoading(true);
			const response = await fetch("/api/candidates");
			if (!response.ok) {
				throw new Error("Failed to fetch candidates");
			}
			const data = await response.json();
			setCandidates(data.candidates || []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	}, []);

	const handleApprove = async (candidateId: string) => {
		try {
			const response = await fetch(`/api/candidates/${candidateId}/promote`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "approve" }),
			});

			if (!response.ok) {
				throw new Error("Failed to approve candidate");
			}

			toast.success("Candidate approved successfully");
			fetchCandidates(); // Refresh list
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to approve candidate",
			);
		}
	};

	const handleReject = async (candidateId: string, reason: string) => {
		try {
			const response = await fetch(`/api/candidates/${candidateId}/promote`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action: "reject", reason }),
			});

			if (!response.ok) {
				throw new Error("Failed to reject candidate");
			}

			toast.success("Candidate rejected successfully");
			fetchCandidates(); // Refresh list
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to reject candidate",
			);
		}
	};

	const handleBatchApprove = async () => {
		const eligibleCandidates = candidates.filter(
			(c) =>
				c.status === "quarantined" &&
				c.quality >= 90 &&
				c.confidence >= 0.8 &&
				c.detectors >= 2,
		);

		if (eligibleCandidates.length === 0) {
			toast.info("No auto-promote eligible candidates found");
			return;
		}

		try {
			await Promise.all(
				eligibleCandidates.map((c) => handleApprove(c.candidateId)),
			);
			toast.success(`Approved ${eligibleCandidates.length} candidates`);
		} catch (_err) {
			toast.error("Failed to batch approve candidates");
		}
	};

	useEffect(() => {
		fetchCandidates();
	}, [fetchCandidates]);

	const failureModes = Array.from(
		new Set(candidates.map((c) => c.failureMode)),
	);
	const filteredCandidates =
		selectedFailureMode === "all"
			? candidates
			: candidates.filter((c) => c.failureMode === selectedFailureMode);

	if (loading) return <div>Loading candidates...</div>;
	if (error) return <div>Error: {error}</div>;

	const eligibleCount = candidates.filter(
		(c) =>
			c.status === "quarantined" &&
			c.quality >= 90 &&
			c.confidence >= 0.8 &&
			c.detectors >= 2,
	).length;

	return (
		<div className="space-y-4">
			{/* Filters and Actions */}
			<div className="flex items-center justify-between">
				<div className="flex items-center space-x-4">
					<Select
						value={selectedFailureMode}
						onValueChange={setSelectedFailureMode}
					>
						<SelectTrigger className="w-48">
							<SelectValue placeholder="Filter by failure mode" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Failure Modes</SelectItem>
							{failureModes.map((mode) => (
								<SelectItem key={mode} value={mode}>
									{mode}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex items-center space-x-2">
					{eligibleCount > 0 && (
						<Button onClick={handleBatchApprove} variant="outline">
							Batch Approve ({eligibleCount})
						</Button>
					)}
				</div>
			</div>

			{/* Candidates Table */}
			<Card>
				<CardHeader>
					<CardTitle>Candidates ({filteredCandidates.length})</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Candidate ID</TableHead>
								<TableHead>Failure Mode</TableHead>
								<TableHead>Quality</TableHead>
								<TableHead>Confidence</TableHead>
								<TableHead>Detectors</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredCandidates.map((candidate) => (
								<TableRow key={candidate.candidateId}>
									<TableCell className="font-mono text-sm">
										{candidate.candidateId}
									</TableCell>
									<TableCell>
										<div className="space-y-1">
											<div>{candidate.failureMode}</div>
											<AutoPromoteIndicator candidate={candidate} />
										</div>
									</TableCell>
									<TableCell>
										<div
											className={`font-mono ${
												candidate.quality >= 90
													? "text-green-600"
													: candidate.quality >= 70
														? "text-yellow-600"
														: "text-red-600"
											}`}
										>
											{candidate.quality}%
										</div>
									</TableCell>
									<TableCell>
										<div
											className={`font-mono ${
												candidate.confidence >= 0.8
													? "text-green-600"
													: candidate.confidence >= 0.6
														? "text-yellow-600"
														: "text-red-600"
											}`}
										>
											{(candidate.confidence * 100).toFixed(1)}%
										</div>
									</TableCell>
									<TableCell>{candidate.detectors}</TableCell>
									<TableCell>
										<StatusBadge status={candidate.status} />
									</TableCell>
									<TableCell>
										<div className="flex items-center space-x-2">
											{candidate.status === "quarantined" && (
												<>
													<Button
														size="sm"
														onClick={() => handleApprove(candidate.candidateId)}
													>
														Approve
													</Button>
													<Button
														size="sm"
														variant="outline"
														onClick={() =>
															setRejectDialog({
																isOpen: true,
																candidate,
															})
														}
													>
														Reject
													</Button>
												</>
											)}
										</div>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			{/* Reject Dialog */}
			{rejectDialog.candidate && (
				<RejectDialog
					candidate={rejectDialog.candidate}
					onReject={handleReject}
					isOpen={rejectDialog.isOpen}
					onClose={() => setRejectDialog({ isOpen: false, candidate: null })}
				/>
			)}
		</div>
	);
}
