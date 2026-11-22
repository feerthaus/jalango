import { mockPoiState } from '@/components/admin/poi/mockPoiData';
import { approveRecord, mergeDuplicate, rejectRecord, rollbackRun, type PoiAdminState, type PoiCategory } from '@/utils/poiReview';

/**
 * What Admin → POI needs from the back end. POI-2A: an in-memory TEST
 * implementation over made-up data (nothing is saved, nothing reaches
 * Supabase). POI-2B swaps in an implementation over Supabase RPCs
 * (poi_review, poi_rollback_run, …) with the same shape, so the screens
 * don't change.
 */
export interface PoiAdminService {
  /** true while the data is test data (the UI says so on every screen) */
  readonly testData: boolean;
  load(): Promise<PoiAdminState>;
  approve(recordId: string, category?: PoiCategory, name?: string): Promise<PoiAdminState>;
  reject(recordId: string, reason: string): Promise<PoiAdminState>;
  merge(recordId: string, intoPoiId: string): Promise<PoiAdminState>;
  rollback(runId: string): Promise<PoiAdminState>;
  /** Test only: start again from the original test data */
  reset(): Promise<PoiAdminState>;
}

export function createMockPoiAdminService(actor = 'admin (ujian)', now: () => string = () => new Date().toISOString()): PoiAdminService {
  let state = mockPoiState();
  const apply = async (f: (s: PoiAdminState) => PoiAdminState) => {
    state = f(state);
    return state;
  };
  return {
    testData: true,
    load: async () => state,
    approve: (id, category, name) => apply((s) => approveRecord(s, id, actor, now(), category, name)),
    reject: (id, reason) => apply((s) => rejectRecord(s, id, actor, now(), reason)),
    merge: (id, into) => apply((s) => mergeDuplicate(s, id, into, actor, now())),
    rollback: (runId) => apply((s) => rollbackRun(s, runId, actor, now())),
    reset: async () => (state = mockPoiState()),
  };
}

/** The service the Admin screen uses. Until POI-2B: test data in memory only. */
export const poiAdminService: PoiAdminService = createMockPoiAdminService();
