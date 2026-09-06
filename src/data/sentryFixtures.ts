import { SentryScan } from '../types';

export const SENTRY_FIXTURES: Record<string, { label: string; description: string; scan: SentryScan }> = {
  tokenSanitizer: {
    label: 'Token Sanitizer (Default Fixture)',
    description: 'sanitizeToken modified under "internal profile refactor" reaching unauthenticated webhook',
    scan: {
      report: {
        modified_symbols: [{ name: 'sanitizeToken', file: 'internal/auth/auth.go', line: 10 }],
        max_depth: 3,
        checkpoint: {
          intent: 'internal profile refactor only',
          declared_scope: ['sanitizeToken']
        },
        impacted_routes: [
          {
            method: 'GET',
            path: '/api/v1/profile',
            handler_name: 'profileHandler',
            authenticated: true,
            depth: 2,
            regression_state: 'existing test selected'
          },
          {
            method: 'POST',
            path: '/api/v1/webhook',
            handler_name: 'webhookHandler',
            authenticated: false,
            depth: 2,
            regression_state: 'coverage stub required'
          }
        ],
        alerts: [
          {
            code: 'SG-UNAUTH-ROUTE',
            severity: 'high',
            route: 'POST /api/v1/webhook',
            message: 'Unauthenticated endpoint is in the structural blast radius.'
          },
          {
            code: 'SG-INTENT-SCOPE',
            severity: 'high',
            route: 'POST /api/v1/webhook',
            message: 'Checkpoint claims an internal-only change, but a public handler is impacted.'
          }
        ],
        test_selection: {
          existing_tests: [{ name: 'TestProfileHandler', file: 'internal/api/profile_test.go' }],
          stubs: [
            'TestwebhookHandler_POST_Regression: exercise POST /api/v1/webhook and assert authorization + input validation'
          ]
        },
        local_risk_score: 8
      },
      intelligence: {
        risk_score: 8,
        classifications: [
          'Structural blast radius',
          'Unauthenticated route exposure',
          'BOLA / IDOR review'
        ],
        recommendations: [
          'Run selected regression tests',
          'Assert object-level authorization and request validation'
        ],
        source: 'local-rules'
      }
    }
  },

  sessionCache: {
    label: 'Session Cache Eviction',
    description: 'evictSession modified under "cache cleanup routine" reaching login and logout handlers',
    scan: {
      report: {
        modified_symbols: [{ name: 'evictSession', file: 'internal/session/store.go', line: 44 }],
        max_depth: 3,
        checkpoint: {
          intent: 'routine cache memory cleanup optimization',
          declared_scope: ['evictSession']
        },
        impacted_routes: [
          {
            method: 'POST',
            path: '/api/v1/auth/login',
            handler_name: 'loginHandler',
            authenticated: false,
            depth: 2,
            regression_state: 'existing test selected'
          },
          {
            method: 'DELETE',
            path: '/api/v1/auth/session',
            handler_name: 'logoutHandler',
            authenticated: true,
            depth: 2,
            regression_state: 'existing test selected'
          },
          {
            method: 'POST',
            path: '/api/v1/auth/refresh',
            handler_name: 'refreshTokenHandler',
            authenticated: false,
            depth: 3,
            regression_state: 'coverage stub required'
          }
        ],
        alerts: [
          {
            code: 'SG-UNAUTH-ROUTE',
            severity: 'high',
            route: 'POST /api/v1/auth/login',
            message: 'Unauthenticated authentication gate is reachable downstream of session eviction changes.'
          },
          {
            code: 'SG-INTENT-SCOPE',
            severity: 'high',
            route: 'POST /api/v1/auth/login',
            message: 'Checkpoint claims "routine cache memory cleanup", but core public authentication handlers are impacted.'
          }
        ],
        test_selection: {
          existing_tests: [
            { name: 'TestLoginHandler', file: 'internal/api/auth_test.go' },
            { name: 'TestLogoutHandler', file: 'internal/api/auth_test.go' }
          ],
          stubs: [
            'TestrefreshTokenHandler_POST_Regression: assert session invalidation upon stale refresh tokens'
          ]
        },
        local_risk_score: 9
      },
      intelligence: {
        risk_score: 9,
        classifications: [
          'Session hijacking risk',
          'Race condition in multi-pod store',
          'Token lifecycle invalidation'
        ],
        recommendations: [
          'Verify atomic lock release during evictSession',
          'Ensure concurrent login requests cannot resurrect expired tokens'
        ],
        source: 'databricks'
      }
    }
  },

  paymentValidator: {
    label: 'Payment Intent Validator',
    description: 'validatePaymentContext modified under "internal currency formatting" reaching checkout and webhook',
    scan: {
      report: {
        modified_symbols: [{ name: 'validatePaymentContext', file: 'internal/billing/validator.go', line: 78 }],
        max_depth: 3,
        checkpoint: {
          intent: 'currency display formatting helper only',
          declared_scope: ['validatePaymentContext']
        },
        impacted_routes: [
          {
            method: 'POST',
            path: '/api/v1/orders/checkout',
            handler_name: 'checkoutHandler',
            authenticated: true,
            depth: 2,
            regression_state: 'existing test selected'
          },
          {
            method: 'POST',
            path: '/api/v1/payments/stripe-webhook',
            handler_name: 'stripeWebhookHandler',
            authenticated: false,
            depth: 2,
            regression_state: 'coverage stub required'
          }
        ],
        alerts: [
          {
            code: 'SG-UNAUTH-ROUTE',
            severity: 'high',
            route: 'POST /api/v1/payments/stripe-webhook',
            message: 'External webhook ingester without session authentication is directly impacted.'
          },
          {
            code: 'SG-INTENT-SCOPE',
            severity: 'high',
            route: 'POST /api/v1/payments/stripe-webhook',
            message: 'Declared "formatting helper" intent fails review: payment execution and webhook replay affected.'
          }
        ],
        test_selection: {
          existing_tests: [{ name: 'TestCheckoutHandler', file: 'internal/billing/checkout_test.go' }],
          stubs: [
            'TeststripeWebhookHandler_POST_Regression: verify HMAC signature verification before validation logic'
          ]
        },
        local_risk_score: 9
      },
      intelligence: {
        risk_score: 9,
        classifications: [
          'Financial transaction alteration',
          'Webhook replay vulnerability',
          'Price precision tampering'
        ],
        recommendations: [
          'Assert webhook signature verification succeeds prior to payment context parsing',
          'Validate integer-cent currency conversions'
        ],
        source: 'databricks'
      }
    }
  },

  dynamicDispatchPlugin: {
    label: 'Dynamic Dispatch & Reflection Plugin Gateway (Partial Analysis Fixture)',
    description: 'processPluginPayload modified under "internal string cleanup" with dynamic reflection reaching webhook and admin handlers',
    scan: {
      report: {
        modified_symbols: [{ name: 'processPluginPayload', file: 'internal/plugins/dispatcher.go', line: 48 }],
        max_depth: 4,
        checkpoint: {
          intent: 'internal plugin helper string cleanup only',
          declared_scope: ['processPluginPayload']
        },
        completeness_status: 'PARTIAL_ANALYSIS',
        partial_analysis: {
          isPartial: true,
          detectedPatterns: ['DYNAMIC_DISPATCH', 'REFLECTION'],
          reasons: [
            'Dynamic string lookup in plugin dispatch map at dispatcher.go:48 prevents deterministic AST call extraction.',
            'Reflective method invocation via reflect.ValueOf().MethodByName at dispatcher.go:52 cannot guarantee complete receiver resolution.'
          ],
          unresolvedCallSites: [
            { filePath: 'internal/plugins/dispatcher.go', line: 48, detail: 'Dynamic plugin lookup: plugins[commandName].Process(ctx, payload)' },
            { filePath: 'internal/plugins/dispatcher.go', line: 52, detail: 'Reflective method invocation: reflect.ValueOf(target).MethodByName(action).Call(args)' }
          ],
          safeFallbackActive: true,
          conservativeBoundingNote: 'Conservative bounding fallback active: potential downstream routes included heuristically. Never assume 0 blast radius under dynamic dispatch.'
        },
        evidence_breakdown: {
          confirmed_count: 1,
          heuristic_count: 2,
          verification_required_count: 3
        },
        impacted_routes: [
          {
            method: 'GET',
            path: '/api/v1/audit/logs',
            handler_name: 'auditHandler',
            authenticated: true,
            depth: 2,
            regression_state: 'existing test selected',
            evidence_tier: 'CONFIRMED_STRUCTURAL',
            resolution: 'exact',
            confidence: 1.0,
            is_partial: false,
            verification_path: {
              verifyCommand: 'VERIFY: go test -v ./internal/api/... -run TestAuditHandler',
              sourceRange: { filePath: 'internal/api/audit.go', startLine: 60, endLine: 80 },
              guidance: 'Deterministic AST edge confirmed: standard regression verification.',
              testFile: 'internal/api/audit_test.go'
            }
          },
          {
            method: 'POST',
            path: '/api/v1/plugins/webhook/ingest',
            handler_name: 'pluginWebhookHandler',
            authenticated: false,
            depth: 2,
            regression_state: 'coverage stub required',
            evidence_tier: 'HEURISTIC_INCOMPLETE',
            resolution: 'dynamic_reflection',
            confidence: 0.55,
            is_partial: true,
            partial_reason: 'Dynamic string lookup in plugin dispatch map at dispatcher.go:48; unauthenticated webhook ingress',
            verification_path: {
              verifyCommand: 'VERIFY: go test -v ./internal/plugins/... -run TestPluginWebhookHandler_DynamicDispatchRegression',
              sourceRange: { filePath: 'internal/plugins/webhook.go', startLine: 85, endLine: 105 },
              guidance: 'Dynamic dispatch detected: run verification suite to assert unauthenticated route isolation.',
              testFile: 'internal/plugins/webhook_test.go'
            }
          },
          {
            method: 'POST',
            path: '/api/v1/plugins/admin/override',
            handler_name: 'adminOverrideHandler',
            authenticated: true,
            depth: 3,
            regression_state: 'coverage stub required',
            evidence_tier: 'HEURISTIC_INCOMPLETE',
            resolution: 'dynamic_reflection',
            confidence: 0.45,
            is_partial: true,
            partial_reason: 'Reflective method invocation MethodByName at dispatcher.go:52',
            verification_path: {
              verifyCommand: 'VERIFY: go test -v ./internal/plugins/... -run TestAdminOverrideHandler_DynamicDispatchRegression',
              sourceRange: { filePath: 'internal/plugins/admin.go', startLine: 110, endLine: 130 },
              guidance: 'Dynamic reflection in path: verify admin role boundary cannot be triggered by unvalidated payloads.',
              testFile: 'internal/plugins/admin_test.go'
            }
          }
        ],
        alerts: [
          {
            code: 'SG-DYNAMIC-DISPATCH-UNRESOLVED',
            severity: 'high',
            route: 'DYNAMIC_BOUNDARY',
            message: 'Dynamic dispatch and reflection encountered in AST traversal. Relationships are marked heuristic and require test verification.',
            evidence: 'Unresolved dynamic boundaries at internal/plugins/dispatcher.go:48. Safe fallback and verification paths engaged.'
          },
          {
            code: 'SG-UNAUTH-ROUTE',
            severity: 'high',
            route: 'POST /api/v1/plugins/webhook/ingest',
            message: 'Unauthenticated endpoint is in the heuristic structural blast radius.',
            evidence: 'Heuristic call chain via dynamic string dispatch [Tier: HEURISTIC_INCOMPLETE, Confidence: 0.55]'
          },
          {
            code: 'SG-INTENT-SCOPE',
            severity: 'high',
            route: 'POST /api/v1/plugins/webhook/ingest',
            message: 'Checkpoint claims "internal helper string cleanup", but dynamic route "pluginWebhookHandler" is impacted.',
            evidence: 'Declared scope leaks into external webhook surface via dynamic plugin gateway'
          }
        ],
        test_selection: {
          existing_tests: [{ name: 'TestAuditHandler', file: 'internal/api/audit_test.go' }],
          stubs: [
            'TestPluginWebhookHandler_POST_Regression: exercise POST /api/v1/plugins/webhook/ingest under dynamic plugin dispatch',
            'TestAdminOverrideHandler_POST_Regression: assert privilege boundary cannot be bypassed via reflective method invocation'
          ]
        },
        local_risk_score: 9
      },
      intelligence: {
        risk_score: 9,
        classifications: [
          'Dynamic dispatch boundary',
          'Incomplete static analysis',
          'Reflection-based bypass risk',
          'Unauthenticated webhook exposure'
        ],
        recommendations: [
          'Run VERIFY test command for pluginWebhookHandler before committing',
          'Refactor reflection method invocation to explicit interface polymorphism',
          'Assert runtime privilege check inside MethodByName target methods'
        ],
        source: 'databricks'
      }
    }
  }
};

