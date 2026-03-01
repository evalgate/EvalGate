"use client";

import { BuilderProvider } from "./builder-context";
import { EvaluationCanvas } from "./evaluation-canvas";
import { TemplateConfigDialog } from "./template-config-dialog";
import { TemplateLibraryPanel } from "./template-library-panel";
import type { EvaluationBuilderProps } from "./types";

export type { EvaluationBuilderProps, SelectedTemplate } from "./types";

export function EvaluationBuilder({ onDeploy }: EvaluationBuilderProps) {
	return (
		<BuilderProvider>
			<div className="flex h-[calc(100vh-12rem)] gap-4">
				<TemplateLibraryPanel />
				<EvaluationCanvas onDeploy={onDeploy} />
				<TemplateConfigDialog />
			</div>
		</BuilderProvider>
	);
}
