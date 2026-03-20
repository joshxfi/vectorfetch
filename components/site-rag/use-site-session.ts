"use client";

import type { FormEvent } from "react";
import { startTransition, useEffect, useEffectEvent, useState } from "react";

import {
  createSiteSessionAction,
  deleteSiteSessionAction,
} from "@/app/actions/site-session";
import {
  ACTIVE_SITE_STORAGE_KEY,
  LEGACY_WORKSPACE_STORAGE_KEY,
} from "@/components/site-rag/helpers";
import type { SiteSessionManifest } from "@/lib/rag/types";

type UseSiteSessionOptions = {
  onConversationReset?: () => void;
};

export function useSiteSession({
  onConversationReset,
}: UseSiteSessionOptions = {}) {
  const [siteId, setSiteId] = useState<string | null>(null);
  const [site, setSite] = useState<SiteSessionManifest | null>(null);
  const [siteUrl, setSiteUrl] = useState("");
  const [siteError, setSiteError] = useState<string | null>(null);
  const [siteBusy, setSiteBusy] = useState(false);

  const rememberSiteId = useEffectEvent((nextSiteId: string | null) => {
    if (nextSiteId) {
      window.localStorage.setItem(ACTIVE_SITE_STORAGE_KEY, nextSiteId);
      window.localStorage.removeItem(LEGACY_WORKSPACE_STORAGE_KEY);
    } else {
      window.localStorage.removeItem(ACTIVE_SITE_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_WORKSPACE_STORAGE_KEY);
    }
  });

  const refreshSite = useEffectEvent(async (nextSiteId: string) => {
    const response = await fetch(`/api/sites/${nextSiteId}`, {
      cache: "no-store",
    });

    if (response.status === 404) {
      rememberSiteId(null);
      startTransition(() => {
        setSiteId(null);
        setSite(null);
        setSiteError("The previous indexed site is no longer available.");
      });
      return;
    }

    const json = (await response.json()) as
      | SiteSessionManifest
      | { error?: string };

    if (!response.ok) {
      startTransition(() => {
        setSiteError(
          "error" in json && typeof json.error === "string"
            ? json.error
            : "Unable to load the current site.",
        );
      });
      return;
    }

    const nextSite = json as SiteSessionManifest;
    startTransition(() => {
      setSite(nextSite);
      setSiteUrl(nextSite.rootUrl);
      setSiteError(null);
    });
  });

  useEffect(() => {
    const savedSiteId =
      window.localStorage.getItem(ACTIVE_SITE_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_WORKSPACE_STORAGE_KEY);

    if (!savedSiteId) {
      return;
    }

    rememberSiteId(savedSiteId);
    startTransition(() => {
      setSiteId(savedSiteId);
    });
    void refreshSite(savedSiteId);
  }, []);

  useEffect(() => {
    if (!siteId || site?.status !== "indexing") {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshSite(siteId);
    }, 1200);

    return () => {
      window.clearInterval(interval);
    };
  }, [site?.status, siteId]);

  async function clearSite() {
    if (!siteId) {
      return;
    }

    setSiteBusy(true);

    try {
      const result = await deleteSiteSessionAction({ siteId });
      if (!result.ok) {
        setSiteError(result.error);
        return;
      }

      rememberSiteId(null);
      startTransition(() => {
        onConversationReset?.();
        setSiteId(null);
        setSite(null);
        setSiteError(null);
      });
    } finally {
      setSiteBusy(false);
    }
  }

  async function submitSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!siteUrl.trim()) {
      setSiteError("Enter a website URL to index.");
      return;
    }

    setSiteBusy(true);
    setSiteError(null);

    try {
      if (siteId) {
        const deleteResult = await deleteSiteSessionAction({ siteId });
        if (!deleteResult.ok) {
          setSiteError(deleteResult.error);
          return;
        }

        rememberSiteId(null);
        startTransition(() => {
          onConversationReset?.();
          setSiteId(null);
          setSite(null);
        });
      }

      const result = await createSiteSessionAction({ url: siteUrl });
      if (!result.ok) {
        setSiteError(result.error);
        return;
      }

      rememberSiteId(result.siteId);
      startTransition(() => {
        onConversationReset?.();
        setSiteId(result.siteId);
        setSite(null);
        setSiteUrl(result.rootUrl);
        setSiteError(null);
      });

      await refreshSite(result.siteId);
    } finally {
      setSiteBusy(false);
    }
  }

  return {
    clearSite,
    refreshSite,
    setSiteUrl,
    site,
    siteBusy,
    siteError,
    siteId,
    siteUrl,
    submitSite,
  };
}
