import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmployeeDocuments } from "@/hooks/useEmployeeDocuments";
import type { DocumentType } from "@/hooks/useDocumentTypes";

export interface ComplianceStatus {
  graceUntil: Date | null;
  isCompliant: boolean;
  isLocked: boolean;
  isInGrace: boolean;
  daysUntilGrace: number | null;
  missingTypes: DocumentType[];
}

/**
 * Computes compliance status for an employee based on their
 * compliance_grace_until date and required document approval state.
 */
export function useComplianceStatus(employeeId: string | undefined | null): ComplianceStatus {
  // Fetch the employee's compliance_grace_until value
  const { data: graceRaw } = useQuery({
    queryKey: ["compliance-grace", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data, error } = await supabase
        .from("employees")
        .select("compliance_grace_until")
        .eq("id", employeeId)
        .single();
      if (error) throw error;
      return data?.compliance_grace_until as string | null;
    },
    enabled: !!employeeId,
  });

  // Fetch required doc types + employee's docs (reuses existing hook)
  const { data: docRows = [] } = useEmployeeDocuments(employeeId ?? undefined);

  return useMemo(() => {
    const graceUntil = graceRaw ? new Date(graceRaw + "T23:59:59") : null;

    // Missing = active required types where doc is null or not approved
    const missingTypes = docRows
      .filter(({ document: doc }) => !doc || doc.status !== "approved")
      .map(({ type }) => type);

    const isCompliant = missingTypes.length === 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const graceDate = graceRaw ? new Date(graceRaw + "T00:00:00") : null;

    const isInGrace = graceDate !== null && today <= graceDate;
    const isLocked = graceDate !== null && today > graceDate && !isCompliant;

    let daysUntilGrace: number | null = null;
    if (graceDate !== null) {
      const diffMs = graceDate.getTime() - today.getTime();
      daysUntilGrace = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    return {
      graceUntil: graceDate,
      isCompliant,
      isLocked,
      isInGrace,
      daysUntilGrace,
      missingTypes,
    };
  }, [graceRaw, docRows]);
}
