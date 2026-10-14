import { dbDateToISOOrNull, toTaipeiDateTimeInput } from "@/lib/dates";
import { DEFAULT_PROJECT_NAME } from "@/server/cases/case-schema";

type CaseRow = {
  projectCode: string;
  projectName: string;
  schoolName: string;
  district: string | null;
  agencyName: string | null;
  agencyContact: string | null;
  agencyEmail: string | null;
  responsibleUserId: string;
  notificationDate: Date | null;
  reviewMeetingDateTime: Date | null;
  reviewMeetingLocation: string | null;
  siteVisitDateTime: Date | null;
  siteVisitLocation: string | null;
  siteVisitUploadUrl: string | null;
  status: string;
  notes: string | null;
};

export function caseToFormValues(c: CaseRow | null, defaults: { responsibleUserId: string; projectName?: string }) {
  return {
    projectCode: c?.projectCode ?? "",
    projectName: c?.projectName ?? defaults.projectName ?? DEFAULT_PROJECT_NAME,
    schoolName: c?.schoolName ?? "",
    district: c?.district ?? "",
    agencyName: c?.agencyName ?? "臺北市政府交通局",
    agencyContact: c?.agencyContact ?? "",
    agencyEmail: c?.agencyEmail ?? "",
    responsibleUserId: c?.responsibleUserId ?? defaults.responsibleUserId,
    notificationDate: dbDateToISOOrNull(c?.notificationDate) ?? "",
    reviewMeetingDateTime: toTaipeiDateTimeInput(c?.reviewMeetingDateTime),
    reviewMeetingLocation: c?.reviewMeetingLocation ?? "",
    siteVisitDateTime: toTaipeiDateTimeInput(c?.siteVisitDateTime),
    siteVisitLocation: c?.siteVisitLocation ?? "",
    siteVisitUploadUrl: c?.siteVisitUploadUrl ?? "",
    status: c?.status ?? "ACTIVE",
    notes: c?.notes ?? "",
    dateChangeReason: "",
  };
}
