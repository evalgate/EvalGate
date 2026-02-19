#!/usr/bin/env node
"use strict";
/**
 * evalai init — Create evalai.config.json
 *
 * Creates the smallest possible config file. Defaults belong in code.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInit = runInit;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const CONFIG_CONTENT = `{
  "evaluationId": ""
}
`;
function runInit(cwd = process.cwd()) {
    const configPath = path.join(cwd, "evalai.config.json");
    if (fs.existsSync(configPath)) {
        console.log(`evalai.config.json already exists at ${path.resolve(configPath)}`);
        return false;
    }
    fs.writeFileSync(configPath, CONFIG_CONTENT, "utf-8");
    const resolvedPath = path.resolve(configPath);
    console.log(`Wrote evalai.config.json at ${resolvedPath}`);
    console.log("");
    console.log("Next: paste evaluationId into evalai.config.json, then run npx -y @pauly4010/evalai-sdk@^1 check --format github --onFail import");
    console.log("");
    console.log("GitHub Actions snippet (add to your workflow):");
    console.log("  - name: EvalAI gate");
    console.log("    env:");
    console.log("      EVALAI_API_KEY: ${{ secrets.EVALAI_API_KEY }}");
    console.log("    run: npx -y @pauly4010/evalai-sdk@^1 check --format github --onFail import");
    console.log("");
    console.log("To uninstall: delete evalai.config.json.");
    return true;
}
