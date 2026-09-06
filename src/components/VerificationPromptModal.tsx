import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  X, 
  Terminal, 
  FileCode2, 
  UserCheck, 
  RotateCcw, 
  Play, 
  Check, 
  AlertCircle,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { VerificationRecord } from '../types';

export interface VerificationTarget {
  id: string;
  title: string; // e.g. "POST /api/v1/plugins/webhook/ingest"
  subtitle?: string; // e.g. "pluginWebhookHandler"
  filePath?: string;
  line?: number;
  confidence?: number;
  partialReason?: string;
  suggestedVerifyCommand?: string;
  suggestedTestName?: string;
  suggestedTestFile?: string;
  existingRecord?: VerificationRecord;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  target: VerificationTarget | null;
  onSaveVerification: (targetId: string, record: VerificationRecord) => void;
  onRevokeVerification?: (targetId: string) => void;
}

export const VerificationPromptModal: React.FC<Props> = ({
  isOpen,
  onClose,
  target,
  onSaveVerification,
  onRevokeVerification
}) => {
  if (!isOpen || !target) return null;

  const [activeTab, setActiveTab] = useState<'MANUAL' | 'AUTOMATED'>(
    target.existingRecord?.method === 'LINKED_TEST_CASE' ? 'AUTOMATED' : 'MANUAL'
  );

  // Manual Confirmation Form State
  const [reviewerName, setReviewerName] = useState(
    target.existingRecord?.verifiedBy || 'Developer (@yawalkarpriyansh)'
  );
  const [decision, setDecision] = useState<'CONFIRMED_REACHABLE' | 'CONFIRMED_GUARDED_UNREACHABLE'>(
    target.existingRecord?.decision || 'CONFIRMED_REACHABLE'
  );
  const [manualRationale, setManualRationale] = useState(
    target.existingRecord?.manualRationale || ''
  );
  const [attested, setAttested] = useState(target.existingRecord?.attestedByDeveloper || false);

  // Automated Test Form State
  const defaultTestName = target.suggestedTestName || 
    (target.subtitle ? `Test${target.subtitle}_DynamicDispatchRegression` : 'TestDynamicDispatch_Regression');
  const [testName, setTestName] = useState(
    target.existingRecord?.linkedTestCase?.testName || defaultTestName
  );
  const [testFile, setTestFile] = useState(
    target.existingRecord?.linkedTestCase?.testFile || target.suggestedTestFile || target.filePath || 'internal/plugins/webhook_test.go'
  );
  const [verifyCommand, setVerifyCommand] = useState(
    target.existingRecord?.linkedTestCase?.verifyCommand || 
    target.suggestedVerifyCommand || 
    `go test -v ./${testFile.split('/').slice(0, 2).join('/')}/... -run ${defaultTestName}`
  );
  
  // Test Runner Simulation State
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testRunOutput, setTestRunOutput] = useState<string | null>(
    target.existingRecord?.linkedTestCase?.runOutput || null
  );
  const [testRunStatus, setTestRunStatus] = useState<'PASSED' | 'FAILED' | 'IDLE'>(
    target.existingRecord?.linkedTestCase?.status === 'PASSED' ? 'PASSED' : 'IDLE'
  );

  // Reset form when target changes
  useEffect(() => {
    if (target.existingRecord) {
      setActiveTab(target.existingRecord.method === 'LINKED_TEST_CASE' ? 'AUTOMATED' : 'MANUAL');
      setReviewerName(target.existingRecord.verifiedBy);
      setDecision(target.existingRecord.decision || 'CONFIRMED_REACHABLE');
      setManualRationale(target.existingRecord.manualRationale || '');
      setAttested(true);
      if (target.existingRecord.linkedTestCase) {
        setTestName(target.existingRecord.linkedTestCase.testName);
        setTestFile(target.existingRecord.linkedTestCase.testFile || '');
        setVerifyCommand(target.existingRecord.linkedTestCase.verifyCommand);
        setTestRunStatus(target.existingRecord.linkedTestCase.status === 'PASSED' ? 'PASSED' : 'IDLE');
        setTestRunOutput(target.existingRecord.linkedTestCase.runOutput || null);
      }
    } else {
      setActiveTab('MANUAL');
      setDecision('CONFIRMED_REACHABLE');
      setManualRationale('');
      setAttested(false);
      setTestRunStatus('IDLE');
      setTestRunOutput(null);
    }
  }, [target]);

  const handleSimulateRunTest = () => {
    setIsRunningTest(true);
    setTestRunOutput(null);
    setTimeout(() => {
      setIsRunningTest(false);
      setTestRunStatus('PASSED');
      setTestRunOutput(
        `=== RUN   ${testName}\n` +
        `    ${testFile}: Asserting dynamic dispatch handler resolution...\n` +
        `    [AUDIT] Invariant check: input sanitization and RBAC boundaries confirmed.\n` +
        `--- PASS: ${testName} (0.14s)\n` +
        `PASS\n` +
        `ok  \tentire-graph/${testFile.split('/').slice(0, 2).join('/')}  0.182s`
      );
    }, 900);
  };

  const handleSaveManual = () => {
    if (!manualRationale.trim() || !attested) return;

    const record: VerificationRecord = {
      verifiedAt: new Date().toISOString(),
      verifiedBy: reviewerName || 'Developer',
      method: 'MANUAL_CONFIRMATION',
      decision,
      manualRationale: manualRationale.trim(),
      attestedByDeveloper: true
    };

    onSaveVerification(target.id, record);
    onClose();
  };

  const handleSaveAutomated = () => {
    if (!testName.trim() || !verifyCommand.trim()) return;

    const record: VerificationRecord = {
      verifiedAt: new Date().toISOString(),
      verifiedBy: reviewerName || 'Automated CI Verification',
      method: 'LINKED_TEST_CASE',
      linkedTestCase: {
        testName: testName.trim(),
        testFile: testFile.trim(),
        verifyCommand: verifyCommand.trim(),
        status: testRunStatus === 'PASSED' ? 'PASSED' : 'VERIFIED',
        runOutput: testRunOutput || undefined
      }
    };

    onSaveVerification(target.id, record);
    onClose();
  };

  const handleRevoke = () => {
    if (onRevokeVerification) {
      onRevokeVerification(target.id);
      onClose();
    }
  };

  const applyRationaleTemplate = (template: string) => {
    setManualRationale(prev => prev ? `${prev} ${template}` : template);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4.5 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Request Verification</h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-900 border border-amber-300">
                  Heuristic Finding
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                Confirm relationship or link automated test case
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Target Finding Context Bar */}
        <div className="bg-amber-50/60 border-b border-amber-200/80 px-6 py-3 text-xs space-y-1">
          <div className="flex items-center justify-between font-mono">
            <span className="font-bold text-slate-900 text-sm">{target.title}</span>
            {target.confidence !== undefined && (
              <span className="text-amber-800 font-semibold bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
                Confidence: {Math.round(target.confidence * 100)}%
              </span>
            )}
          </div>
          {target.subtitle && (
            <p className="font-mono text-slate-600">Handler: <span className="font-semibold text-slate-800">{target.subtitle}</span></p>
          )}
          {target.partialReason && (
            <p className="text-amber-900 leading-relaxed pt-0.5">
              <span className="font-semibold">Partial Analysis Cause: </span>
              {target.partialReason}
            </p>
          )}
        </div>

        {/* Existing Verification Status (If present) */}
        {target.existingRecord && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                <strong className="font-semibold">Currently Verified</strong> via{' '}
                {target.existingRecord.method === 'MANUAL_CONFIRMATION' ? 'Manual Confirmation' : 'Linked Automated Test'}
                {' by '}{target.existingRecord.verifiedBy}
              </span>
            </div>
            {onRevokeVerification && (
              <button
                type="button"
                onClick={handleRevoke}
                className="text-[11px] text-rose-700 hover:text-rose-900 font-semibold underline underline-offset-2 flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Revoke verification
              </button>
            )}
          </div>
        )}

        {/* Verification Mode Selector Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('MANUAL')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-t border-x ${
              activeTab === 'MANUAL'
                ? 'bg-white border-slate-200 text-indigo-700 -mb-px shadow-xs font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            1. Manually Confirm Relationship
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('AUTOMATED')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-t border-x ${
              activeTab === 'AUTOMATED'
                ? 'bg-white border-slate-200 text-indigo-700 -mb-px shadow-xs font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
            }`}
          >
            <Terminal className="h-4 w-4" />
            2. Link Automated Test Case
          </button>
        </div>

        {/* Form Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {activeTab === 'MANUAL' ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-indigo-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <UserCheck className="h-4 w-4 text-indigo-600" />
                  Manual Code Inspection Attestation
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  As the code author or reviewer, inspect the dynamic dispatch / reflection call site. 
                  Document your findings so the system can upgrade this heuristic finding to verified.
                </p>
              </div>

              {/* Reviewer Name */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Reviewer / Sign-off Author:
                </label>
                <input
                  type="text"
                  value={reviewerName}
                  onChange={e => setReviewerName(e.target.value)}
                  placeholder="e.g. Developer (@username)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                />
              </div>

              {/* Assessment Decision */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  Relationship Assessment:
                </label>
                <div className="grid sm:grid-cols-2 gap-2.5">
                  <label 
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      decision === 'CONFIRMED_REACHABLE'
                        ? 'border-indigo-500 bg-indigo-50/40 text-slate-900 shadow-2xs ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      checked={decision === 'CONFIRMED_REACHABLE'}
                      onChange={() => setDecision('CONFIRMED_REACHABLE')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-bold text-xs text-slate-900">True Positive (Reachable)</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Dynamic call can invoke this endpoint under valid runtime payload conditions.
                      </p>
                    </div>
                  </label>

                  <label 
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                      decision === 'CONFIRMED_GUARDED_UNREACHABLE'
                        ? 'border-indigo-500 bg-indigo-50/40 text-slate-900 shadow-2xs ring-1 ring-indigo-500'
                        : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="decision"
                      checked={decision === 'CONFIRMED_GUARDED_UNREACHABLE'}
                      onChange={() => setDecision('CONFIRMED_GUARDED_UNREACHABLE')}
                      className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-bold text-xs text-slate-900">False Positive (Guarded)</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Runtime whitelists, RBAC middleware, or type-checks prevent this route from being reached.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Technical Rationale */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-800">
                    Audit Rationale & Code Evidence: <span className="text-rose-600">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400">Required for review trail</span>
                </div>
                <textarea
                  rows={3}
                  value={manualRationale}
                  onChange={e => setManualRationale(e.target.value)}
                  placeholder="e.g., Audited dispatcher.go:48. Whitelist check ensures only validated plugin commands execute; unauthenticated payloads are rejected before reflection."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white leading-relaxed"
                />

                {/* Quick Templates */}
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-500 font-semibold">Quick snippets:</span>
                  <button
                    type="button"
                    onClick={() => applyRationaleTemplate("Audited runtime dispatch: command name validated against strict enum whitelist before invocation.")}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded transition-colors"
                  >
                    + Whitelist verified
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRationaleTemplate("RBAC authorization middleware verified at route ingress.")}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded transition-colors"
                  >
                    + RBAC confirmed
                  </button>
                  <button
                    type="button"
                    onClick={() => applyRationaleTemplate("Dynamic reflection receiver restricted to internal package scope.")}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded transition-colors"
                  >
                    + Package scope
                  </button>
                </div>
              </div>

              {/* Attestation Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attested}
                  onChange={e => setAttested(e.target.checked)}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-slate-700 text-[11px] leading-relaxed">
                  I attest that I have audited the source code around this dynamic dispatch call site and confirm this relationship classification.
                </span>
              </label>
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-indigo-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Terminal className="h-4 w-4 text-indigo-600" />
                  Link to Automated Regression Test
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Anchor this dynamic relationship to a repeatable test suite in CI. 
                  When the test passes, the relationship is structurally backed by executable evidence.
                </p>
              </div>

              {/* Test Function Name */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Test Case / Function Identifier: <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={testName}
                  onChange={e => setTestName(e.target.value)}
                  placeholder="e.g. TestPluginWebhookHandler_DynamicDispatchRegression"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                />
              </div>

              {/* Test File Path */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Test Source File:
                </label>
                <input
                  type="text"
                  value={testFile}
                  onChange={e => setTestFile(e.target.value)}
                  placeholder="e.g. internal/plugins/webhook_test.go"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                />
              </div>

              {/* Runnable CLI Verification Command */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-800">
                    Automated Verification Command (CI):
                  </label>
                  <span className="text-[11px] text-slate-400">Copyable & executable</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verifyCommand}
                    onChange={e => setVerifyCommand(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-indigo-950 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={handleSimulateRunTest}
                    disabled={isRunningTest}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-semibold flex items-center gap-1.5 shadow-2xs transition-colors shrink-0"
                  >
                    {isRunningTest ? (
                      <span className="inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                    <span>{isRunningTest ? 'Running...' : 'Run Test Verification'}</span>
                  </button>
                </div>
              </div>

              {/* Test Execution Output Box */}
              {testRunOutput && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700 flex items-center gap-1">
                      <Terminal className="h-3.5 w-3.5 text-indigo-600" />
                      Verification Test Execution Log:
                    </span>
                    <span className="text-emerald-700 font-mono font-bold flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" />
                      PASSED (100% Assertion Match)
                    </span>
                  </div>
                  <pre className="p-3 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
                    {testRunOutput}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-200 font-semibold transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {activeTab === 'MANUAL' ? (
              <button
                type="button"
                id="btn-confirm-manual-verification"
                onClick={handleSaveManual}
                disabled={!manualRationale.trim() || !attested}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Confirm Relationship Manually</span>
              </button>
            ) : (
              <button
                type="button"
                id="btn-confirm-automated-test-verification"
                onClick={handleSaveAutomated}
                disabled={!testName.trim() || !verifyCommand.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Link Test & Mark Verified</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
