import type { CallStore } from "../../store/callStore.ts";
import type { CallRequest, PlacedCall, VoiceProvider } from "../voiceProvider.ts";
import type { VapiClient } from "./client.ts";
import { buildCallPayload, phoneNumberIdFor, type PhoneRouting } from "./payloads.ts";

export interface VapiProviderOptions {
  client: VapiClient;
  store: CallStore;
  assistants: { female: string; male: string };
  phoneNumbers: PhoneRouting;
}

/** Places calls through Vapi; results arrive later via the webhook server into the same CallStore. */
export class VapiVoiceProvider implements VoiceProvider {
  readonly name = "vapi";

  constructor(private readonly o: VapiProviderOptions) {
    if (!o.assistants.female || !o.assistants.male) throw new Error("Set VAPI_ASSISTANT_ID_FEMALE and VAPI_ASSISTANT_ID_MALE (run npm run vapi:sync)");
  }

  async placeCall(req: CallRequest): Promise<PlacedCall> {
    const payload = buildCallPayload(req, this.o.assistants[req.persona.gender], phoneNumberIdFor(req.applicant.country, this.o.phoneNumbers));
    // One POST per attempt. A timeout here does NOT prove the call failed — the campaign
    // orchestrator (Phase 3) must look the call up before ever retrying the same attemptKey.
    const call = await this.o.client.request<{ id: string }>("POST", "/call", payload);
    this.o.store.registerCall(call.id, req.attemptKey, req.applicant.id);
    return { providerCallId: call.id };
  }
}
