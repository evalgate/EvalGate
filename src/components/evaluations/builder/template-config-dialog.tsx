"use client";

import { Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBuilder } from "./builder-context";
import { TemplateCriteriaTab } from "./template-criteria-tab";
import { TemplateOverviewTab } from "./template-overview-tab";
import { TemplateSettingsTab } from "./template-settings-tab";

export function TemplateConfigDialog() {
	const { activeTemplateData, setActiveTemplate, activeTab, setActiveTab } =
		useBuilder();

	return (
		<Dialog
			open={!!activeTemplateData}
			onOpenChange={(open) => !open && setActiveTemplate(null)}
		>
			<DialogContent className="max-w-5xl h-[95vh] flex flex-col p-0">
				<DialogHeader className="px-6 pt-6 pb-4 border-b">
					<DialogTitle className="flex items-center gap-2">
						<Settings className="h-5 w-5" />
						Configure Template
					</DialogTitle>
				</DialogHeader>

				{activeTemplateData && (
					<div className="flex-1 flex flex-col min-h-0 px-6 pb-6">
						<Card className="border-primary/20 bg-primary/5 mt-4 mb-4 flex-shrink-0">
							<CardContent className="p-4 space-y-3">
								<div className="flex items-start gap-3">
									{(() => {
										const Icon = activeTemplateData.template.icon;
										return (
											<Icon className="h-6 w-6 text-primary mt-0.5 flex-shrink-0" />
										);
									})()}
									<div className="flex-1 min-w-0">
										<h4 className="font-semibold text-base leading-tight">
											{activeTemplateData.template.name}
										</h4>
										<p className="text-sm text-muted-foreground mt-1">
											{activeTemplateData.template.description}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-2 flex-wrap">
									<Badge variant="outline" className="text-xs">
										{activeTemplateData.template.type.replace("_", " ")}
									</Badge>
									<Badge variant="outline" className="text-xs">
										{activeTemplateData.template.complexity}
									</Badge>
								</div>
							</CardContent>
						</Card>

						<Tabs
							value={activeTab}
							onValueChange={setActiveTab}
							className="flex-1 flex flex-col min-h-0"
						>
							<TabsList className="grid w-full grid-cols-3 mb-4 flex-shrink-0">
								<TabsTrigger value="overview">Overview</TabsTrigger>
								<TabsTrigger value="criteria">Criteria</TabsTrigger>
								<TabsTrigger value="settings">Settings</TabsTrigger>
							</TabsList>

							<TemplateOverviewTab />
							<TemplateCriteriaTab />
							<TemplateSettingsTab />
						</Tabs>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
