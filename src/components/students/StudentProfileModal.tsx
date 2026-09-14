import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  BookOpen, 
  GraduationCap, 
  Building, 
  Mail, 
  Phone, 
  AlertTriangle, 
  Printer,
  ShieldCheck,
  CheckCircle,
  Download,
  Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import { toPng } from 'html-to-image';
import { ISGG_LOGO_DATA_URL } from '../../lib/isggLogo';
import { storage, formatFrenchDate } from '../../lib/storage';
import { useToast } from '../common/Toast';
import { StudentWithStats, Subject } from '../../types';

interface StudentProfileModalProps {
  studentId: string | null;
  onClose: () => void;
}

export const StudentProfileModal: React.FC<StudentProfileModalProps> = ({ studentId, onClose }) => {
  const [student, setStudent] = useState<StudentWithStats | null>(() => studentId ? storage.getStudentWithStats(studentId) || null : null);
  const [subjects, setSubjects] = useState<Subject[]>(() => storage.getAllSubjects());
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const { showToast } = useToast();

  const currentUser = storage.getCurrentUser();
  const schoolYear = storage.getSchoolYear();

  useEffect(() => {
    const update = () => {
      if (studentId) {
        setStudent(storage.getStudentWithStats(studentId) || null);
      }
      setSubjects(storage.getAllSubjects());
    };
    update();
    const unsub = storage.subscribe(update);
    return () => unsub();
  }, [studentId]);

  // Fermeture accessible avec la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const cleanLevelName = (name?: string) => {
    if (!name) return '';
    return name.replace(/^[0-9]+[èe]me?\s+année\s*\((Licence\s+[0-9]+)\)/i, '$1').trim();
  };

  // Helper to accurately resolve an absence's subject without arbitrary overwriting
  const getSubjectForAbsence = (abs: { subjectId: string; startTime?: string; absenceTime?: string; className?: string }): Subject | undefined => {
    let sub = subjects.find(s => s.id === abs.subjectId);
    if (sub) return sub;

    // Academic resolution for ISGG SIL2 sessions
    if ((abs.startTime === '08:00' || abs.absenceTime?.startsWith('08')) && (abs.className?.includes('SIL2') || student?.levelId === 'lvl-l2')) {
      const ceo = subjects.find(s => s.id === 'sub-l2-communication-ecrite-2');
      if (ceo) return ceo;
    }
    if ((abs.startTime === '13:00' || abs.absenceTime?.startsWith('13')) && (abs.className?.includes('SIL2') || student?.levelId === 'lvl-l2')) {
      const alg = subjects.find(s => s.id === 'sub-l2-algebre-lineaire');
      if (alg) return alg;
    }

    return undefined;
  };

  // Breakdown by subject
  const subjectBreakdown = useMemo(() => {
    if (!student) return [];
    const counts: Record<string, { count: number; justifiedCount: number; name: string; code: string }> = {};

    student.recentAbsences?.forEach(a => {
      const sub = getSubjectForAbsence(a);
      const targetId = sub ? sub.id : a.subjectId;
      const targetName = sub ? sub.name : 'Matière spécifique';
      const targetCode = sub ? sub.code : '';

      if (!counts[targetId]) {
        counts[targetId] = { count: 0, justifiedCount: 0, name: targetName, code: targetCode };
      }
      if (!a.justified) {
        counts[targetId].count += 1;
      } else {
        counts[targetId].justifiedCount += 1;
      }
    });

    return Object.entries(counts).map(([subId, data]) => ({
      id: subId,
      name: data.name,
      code: data.code,
      count: data.count,
      justifiedCount: data.justifiedCount,
    })).sort((a, b) => b.count - a.count);
  }, [student, subjects]);

  const handleToggleAbsenceJustified = (absenceId: string) => {
    storage.toggleAbsenceJustified(absenceId);
  };

  if (!student) return null;

  // Header HTML for First Page
  const getFirstPageHeaderHtml = () => {
    if (!student) return '';
    const totalAbsencesCount = student.recentAbsences?.length || 0;
    const unjustifiedCount = student.annualAbsenceCount || 0;
    const justifiedCount = student.justifiedAbsenceCount || 0;
    const totalHours = totalAbsencesCount * 2;

    return `
      <div>
        <!-- En-tête officiel ISGG -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px; border-bottom: 2px solid #0f172a;">
          <div style="display: flex; flex-direction: column; align-items: center;">
            <img src="${ISGG_LOGO_DATA_URL}" alt="Logo ISGG" style="height: 52px; width: auto; object-fit: contain;" />
            <span style="font-size: 10px; font-style: italic; font-family: serif; color: #1e293b; margin-top: 2px;">
              Les vertus de la réussite
            </span>
          </div>
          <div style="text-align: right; max-width: 460px;">
            <h1 style="font-size: 13px; font-weight: 900; text-transform: uppercase; font-family: serif; margin: 0; color: #020617; line-height: 1.2;">
              INSTITUT SUPERIEUR DE GENIE CIVIL ET DE GESTION
            </h1>
            <div style="margin-top: 4px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px; background: #f8fafc; font-size: 7.5px; line-height: 1.2; text-align: left;">
              <p style="font-weight: bold; margin: 0 0 2px 0;">Autorisations de l'État :</p>
              <p style="margin: 0;">• Avis favorable CNE N°2021-0281/CNE/PCQR/SE</p>
              <p style="margin: 0;">• Notification DGES N°2308/MESRS/DC/SGM/DGES/SA</p>
              <p style="margin: 0;">• Arrêté MESRS N°0272/MESRS/DC/SGM/DGES/CTJ/CJSA/021 S0022</p>
            </div>
          </div>
        </div>

        <!-- Titre officiel encadré -->
        <div style="border: 2px solid #000; padding: 6px 12px; text-align: center; margin: 10px 0; background: #ffffff;">
          <h2 style="font-size: 12.5px; font-weight: 900; text-transform: uppercase; margin: 0; letter-spacing: 0.5px; color: #000;">
            FICHE INDIVIDUELLE D'ASSIDUITÉ ET DE SUIVI DES ABSENCES
          </h2>
          <p style="font-size: 9px; font-weight: bold; color: #334155; margin: 2px 0 0 0; text-transform: uppercase;">
            Année Académique : ${schoolYear?.name || '2026-2027'}
          </p>
        </div>

        <!-- Fiche d'identité de l'étudiant -->
        <div style="border: 1px solid #000; padding: 7px 10px; background: #f8fafc; margin-bottom: 10px; font-size: 10.5px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px 14px;">
            <div>
              <span style="font-weight: bold; color: #475569; font-size: 9.5px; text-transform: uppercase;">Matricule : </span>
              <span style="font-family: monospace; font-weight: 900; color: #000;">${student.matricule}</span>
            </div>
            <div>
              <span style="font-weight: bold; color: #475569; font-size: 9.5px; text-transform: uppercase;">Filière : </span>
              <span style="font-weight: bold; color: #000;">${student.programName}</span>
            </div>
            <div>
              <span style="font-weight: bold; color: #475569; font-size: 9.5px; text-transform: uppercase;">Nom & Prénoms : </span>
              <span style="font-weight: 900; text-transform: uppercase; color: #000;">${student.lastName} ${student.firstName}</span>
            </div>
            <div>
              <span style="font-weight: bold; color: #475569; font-size: 9.5px; text-transform: uppercase;">Niveau & Classe : </span>
              <span style="font-weight: bold; color: #000;">${cleanLevelName(student.levelName)} — Groupe ${student.classGroup || 'A'}</span>
            </div>
          </div>
        </div>

        <!-- Indicateurs synthétiques -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 10px; text-align: center;">
          <div style="border: 1px solid #000; padding: 5px; background: #ffffff;">
            <span style="display: block; font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #475569;">Total Absences</span>
            <span style="font-size: 13px; font-weight: 900; color: #000;">${totalAbsencesCount} séance${totalAbsencesCount > 1 ? 's' : ''} (${totalHours}h)</span>
          </div>
          <div style="border: 1px solid #000; padding: 5px; background: #ffffff;">
            <span style="display: block; font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #475569;">Justifiées</span>
            <span style="font-size: 13px; font-weight: 900; color: #065f46;">${justifiedCount} séance${justifiedCount > 1 ? 's' : ''}</span>
          </div>
          <div style="border: 1px solid #000; padding: 5px; background: #ffffff;">
            <span style="display: block; font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #475569;">Non Justifiées</span>
            <span style="font-size: 13px; font-weight: 900; ${unjustifiedCount > 6 ? 'color: #991b1b;' : 'color: #000;'}">
              ${unjustifiedCount} séance${unjustifiedCount > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    `;
  };

  // Header HTML for subsequent pages
  const getSubsequentPageHeaderHtml = () => {
    if (!student) return '';
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 6px; margin-bottom: 8px; border-bottom: 2px solid #0f172a; font-family: system-ui, sans-serif;">
        <span style="font-size: 11px; font-weight: 900; text-transform: uppercase; color: #000;">
          INSTITUT SUPERIEUR DE GENIE CIVIL ET DE GESTION (ISGG)
        </span>
        <span style="font-size: 9px; font-weight: bold; color: #475569; font-style: italic;">
          Fiche d'assiduité : ${student.lastName} ${student.firstName} (${student.matricule}) — (Suite)
        </span>
      </div>
    `;
  };

  // Official Signature Block
  const getSignatureHtml = () => {
    return `
      <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
        <div style="width: 270px; text-align: center;">
          <p style="font-size: 9.5px; font-weight: bold; margin: 0; color: #000;">
            Fait à Abomey-Calavi, le ${formatFrenchDate(new Date().toISOString().slice(0, 10))}
          </p>
          <p style="font-size: 9.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; margin: 2px 0 0 0; color: #000;">
            La Surveillance Générale & Direction
          </p>
          <div style="height: 46px;"></div>
          <p style="font-size: 10.5px; font-weight: 900; text-transform: uppercase; text-decoration: underline; margin: 0; color: #020617;">
            ${currentUser?.name || 'Le Surveillant Général'}
          </p>
        </div>
      </div>
    `;
  };

  // Official Footer Block (Always locked at bottom of A4 page)
  const getFooterHtml = (pageNum: number, totalPages: number) => {
    return `
      <div class="print-page-footer" style="margin-top: auto !important; padding-top: 6px; border-top: 2px solid #ea580c; font-size: 8px; line-height: 1.25; text-align: center; color: #334155; width: 100%;">
        <div style="display: flex; justify-content: space-between; font-size: 8.5px; font-weight: bold; color: #64748b; margin-bottom: 2px; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px;">
          <span>Institut Supérieur de Génie Civil et de Gestion (ISGG)</span>
          <span>Page ${pageNum} / ${totalPages}</span>
        </div>
        <p style="margin: 0; font-weight: 500;">
          Siège : Ab-Calavi, Aganmandin, Immeuble BOA, 1er et 2ème étages, BP : 1938 Abomey-Calavi
        </p>
        <p style="margin: 1px 0 0 0; font-weight: bold; color: #0f172a;">
          E-mail : isgg229@gmail.com - IFU : 3202346783540 - Tel. : 97 00 67 67 / 94 00 40 40
        </p>
      </div>
    `;
  };

  // Table Renderer
  const renderTableHtml = (rowList: Array<{
    idx: number;
    date: string;
    time: string;
    subjectName: string;
    justified: boolean;
    reason: string;
  }>) => {
    if (rowList.length === 0) {
      return `
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 9px; line-height: 1.2;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="border: 1px solid #000; padding: 4px 6px; width: 32px; text-align: center; font-weight: 900;">N°</th>
              <th style="border: 1px solid #000; padding: 4px 6px; width: 85px; text-align: center; font-weight: 900;">Date</th>
              <th style="border: 1px solid #000; padding: 4px 6px; width: 80px; text-align: center; font-weight: 900;">Horaire</th>
              <th style="border: 1px solid #000; padding: 4px 6px; text-align: left; font-weight: 900;">Matière</th>
              <th style="border: 1px solid #000; padding: 4px 6px; width: 95px; text-align: center; font-weight: 900;">Statut</th>
              <th style="border: 1px solid #000; padding: 4px 6px; width: 140px; text-align: center; font-weight: 900;">Observation / Motif</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="6" style="border: 1px solid #000; padding: 24px 10px; text-align: center; font-weight: bold; color: #065f46; font-size: 11px;">
                Aucune absence constatée. Assiduité exemplaire (100%).
              </td>
            </tr>
          </tbody>
        </table>
      `;
    }

    return `
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; font-size: 9px; line-height: 1.2;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="border: 1px solid #000; padding: 4px 6px; width: 32px; text-align: center; font-weight: 900;">N°</th>
            <th style="border: 1px solid #000; padding: 4px 6px; width: 85px; text-align: center; font-weight: 900;">Date</th>
            <th style="border: 1px solid #000; padding: 4px 6px; width: 80px; text-align: center; font-weight: 900;">Horaire</th>
            <th style="border: 1px solid #000; padding: 4px 6px; text-align: left; font-weight: 900;">Matière</th>
            <th style="border: 1px solid #000; padding: 4px 6px; width: 95px; text-align: center; font-weight: 900;">Statut</th>
            <th style="border: 1px solid #000; padding: 4px 6px; width: 140px; text-align: center; font-weight: 900;">Observation / Motif</th>
          </tr>
        </thead>
        <tbody>
          ${rowList.map(r => `
            <tr>
              <td style="border: 1px solid #000; padding: 3px 5px; text-align: center; font-weight: bold;">${r.idx}</td>
              <td style="border: 1px solid #000; padding: 3px 5px; text-align: center; white-space: nowrap;">${r.date}</td>
              <td style="border: 1px solid #000; padding: 3px 5px; text-align: center; font-family: monospace;">${r.time}</td>
              <td style="border: 1px solid #000; padding: 3px 5px; font-weight: bold;">${r.subjectName}</td>
              <td style="border: 1px solid #000; padding: 3px 5px; text-align: center; font-weight: 900; ${r.justified ? 'color: #065f46;' : 'color: #991b1b;'}">
                ${r.justified ? 'JUSTIFIÉE' : 'NON JUSTIFIÉE'}
              </td>
              <td style="border: 1px solid #000; padding: 3px 5px; text-align: center; font-size: 8px;">
                ${r.reason}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  // Unified A4 Pagination Engine: shared between PDF export and physical printing
  const paginateStudentAttendance = () => {
    if (!student) return null;

    const A4_WIDTH = 800;
    const A4_HEIGHT = 1131;
    const PADDING = 26;
    const FOOTER_SPACE = 72;
    const USABLE_HEIGHT = A4_HEIGHT - (PADDING * 2) - FOOTER_SPACE;

    const absences = student.recentAbsences || [];
    const rows = absences.map((abs, idx) => {
      const sub = getSubjectForAbsence(abs);
      return {
        idx: idx + 1,
        date: formatFrenchDate(abs.absenceDate),
        time: abs.absenceTime || '08:00 - 10:00',
        subjectName: sub ? sub.name : 'Matière spécifique',
        justified: !!abs.justified,
        reason: abs.justificationReason || (abs.justified ? 'Justificatif validé' : 'Aucun motif fourni'),
      };
    });

    // If no absences, 1 single page with zero-state message
    if (rows.length === 0) {
      return {
        A4_WIDTH,
        A4_HEIGHT,
        PADDING,
        pages: [
          {
            isFirstPage: true,
            rows: [],
            hasSignature: true,
          }
        ]
      };
    }

    // Temporary measuring container
    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    stage.style.left = '-9999px';
    stage.style.top = '0';
    stage.style.width = `${A4_WIDTH}px`;
    stage.style.backgroundColor = '#ffffff';
    stage.style.zIndex = '-9999';
    document.body.appendChild(stage);

    const testBox = document.createElement('div');
    testBox.style.width = `${A4_WIDTH - (PADDING * 2)}px`;
    testBox.style.boxSizing = 'border-box';
    stage.appendChild(testBox);

    const renderTestContent = (isFirstPage: boolean, rowList: typeof rows, withSig: boolean) => {
      return `
        <div>
          ${isFirstPage ? getFirstPageHeaderHtml() : getSubsequentPageHeaderHtml()}
          <div style="margin-top: 8px;">
            ${renderTableHtml(rowList)}
          </div>
          ${withSig ? getSignatureHtml() : ''}
        </div>
      `;
    };

    interface StudentSheetPageData {
      isFirstPage: boolean;
      rows: typeof rows;
      hasSignature: boolean;
    }

    const pages: StudentSheetPageData[] = [];
    let currentPage: StudentSheetPageData = {
      isFirstPage: true,
      rows: [],
      hasSignature: false,
    };
    pages.push(currentPage);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      testBox.innerHTML = renderTestContent(currentPage.isFirstPage, [...currentPage.rows, r], false);
      if (testBox.offsetHeight > USABLE_HEIGHT && currentPage.rows.length > 0) {
        currentPage = {
          isFirstPage: false,
          rows: [r],
          hasSignature: false,
        };
        pages.push(currentPage);
      } else {
        currentPage.rows.push(r);
      }
    }

    // Verify signature placement
    testBox.innerHTML = renderTestContent(currentPage.isFirstPage, currentPage.rows, true);
    if (testBox.offsetHeight <= USABLE_HEIGHT) {
      currentPage.hasSignature = true;
    } else {
      currentPage = {
        isFirstPage: false,
        rows: [],
        hasSignature: true,
      };
      pages.push(currentPage);
    }

    if (document.body.contains(stage)) {
      document.body.removeChild(stage);
    }

    return {
      A4_WIDTH,
      A4_HEIGHT,
      PADDING,
      pages,
    };
  };

  // Official PDF Export identical to ReportsView procedure
  const handleExportPDF = async () => {
    if (!student) return;
    const pagination = paginateStudentAttendance();
    if (!pagination) {
      showToast('Erreur lors de la pagination du document', 'error');
      return;
    }

    const { pages, A4_WIDTH, A4_HEIGHT, PADDING } = pagination;
    const totalPages = pages.length;

    setIsExportingPDF(true);
    showToast(`Génération du PDF officiel (${totalPages} page${totalPages > 1 ? 's' : ''})...`, 'info');

    try {
      // Staging container for toPng rendering
      const stage = document.createElement('div');
      stage.style.position = 'fixed';
      stage.style.left = '-9999px';
      stage.style.top = '0';
      stage.style.width = `${A4_WIDTH}px`;
      stage.style.backgroundColor = '#ffffff';
      stage.style.zIndex = '-9999';
      document.body.appendChild(stage);

      // Initialize jsPDF (A4 portrait)
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      for (let p = 0; p < totalPages; p++) {
        const pageData = pages[p];

        const pageEl = document.createElement('div');
        pageEl.style.width = `${A4_WIDTH}px`;
        pageEl.style.height = `${A4_HEIGHT}px`;
        pageEl.style.boxSizing = 'border-box';
        pageEl.style.padding = `${PADDING}px`;
        pageEl.style.backgroundColor = '#ffffff';
        pageEl.style.display = 'flex';
        pageEl.style.flexDirection = 'column';
        pageEl.style.justifyContent = 'space-between';
        pageEl.style.position = 'relative';
        pageEl.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

        const contentEl = document.createElement('div');
        contentEl.style.flex = '1 1 auto';
        contentEl.style.display = 'flex';
        contentEl.style.flexDirection = 'column';
        contentEl.innerHTML = `
          ${pageData.isFirstPage ? getFirstPageHeaderHtml() : getSubsequentPageHeaderHtml()}
          <div style="margin-top: 8px;">
            ${renderTableHtml(pageData.rows)}
          </div>
          ${pageData.hasSignature ? getSignatureHtml() : ''}
        `;
        pageEl.appendChild(contentEl);

        const footerWrapper = document.createElement('div');
        footerWrapper.innerHTML = getFooterHtml(p + 1, totalPages);
        const footerNode = footerWrapper.firstElementChild as HTMLElement;
        if (footerNode) {
          footerNode.style.marginTop = 'auto';
          pageEl.appendChild(footerNode);
        }

        stage.innerHTML = '';
        stage.appendChild(pageEl);

        const imgData = await toPng(pageEl, {
          quality: 0.98,
          pixelRatio: 2.2,
          backgroundColor: '#ffffff',
          skipFonts: true,
          fontEmbedCSS: '',
        });

        if (p > 0) {
          pdf.addPage('a4', 'portrait');
        }
        pdf.addImage(imgData, 'PNG', 0, 0, 210, 297);
      }

      if (document.body.contains(stage)) {
        document.body.removeChild(stage);
      }

      // Download file using reliable blob link
      const cleanMatricule = (student.matricule || 'etudiant').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = `isgg_fiche_assiduite_${cleanMatricule}.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

      showToast(`Fiche d'assiduité (${student.matricule}) téléchargée avec succès`, 'success');
    } catch (error) {
      console.error('Erreur export PDF fiche assiduité:', error);
      showToast('Échec de la génération du PDF.', 'error');
    } finally {
      setIsExportingPDF(false);
    }
  };

  // High-fidelity Print with footer locked at bottom
  const handlePrint = () => {
    if (!student) return;
    const pagination = paginateStudentAttendance();
    if (!pagination) return;

    const { pages } = pagination;
    const totalPages = pages.length;

    const pagesHtml = pages.map((pageData, p) => `
      <div class="print-a4-page">
        <div class="print-page-content">
          ${pageData.isFirstPage ? getFirstPageHeaderHtml() : getSubsequentPageHeaderHtml()}
          <div style="margin-top: 8px;">
            ${renderTableHtml(pageData.rows)}
          </div>
          ${pageData.hasSignature ? getSignatureHtml() : ''}
        </div>
        ${getFooterHtml(p + 1, totalPages)}
      </div>
    `).join('');

    let printWindow: Window | null = null;
    try {
      printWindow = window.open('', '_blank');
    } catch {
      printWindow = null;
    }

    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Fiche d'assiduité - ${student.lastName} ${student.firstName} (${student.matricule})</title>
            <meta charset="utf-8" />
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page {
                size: A4 portrait;
                margin: 0;
              }
              * {
                box-sizing: border-box;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .print-a4-page {
                width: 210mm;
                height: 297mm;
                max-height: 297mm;
                padding: 9mm 12mm;
                box-sizing: border-box;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                page-break-after: always !important;
                break-after: page !important;
                overflow: hidden;
                background: #ffffff;
              }
              .print-page-content {
                flex: 1 1 auto;
                display: flex;
                flex-direction: column;
              }
              .print-page-footer {
                margin-top: auto !important;
                padding-top: 6px;
                border-top: 2px solid #ea580c;
                font-size: 8px;
                line-height: 1.25;
                text-align: center;
                color: #334155;
                width: 100%;
              }
            </style>
          </head>
          <body>
            ${pagesHtml}
          </body>
        </html>
      `);
      printWindow.document.close();
      setTimeout(() => {
        printWindow?.focus();
        printWindow?.print();
      }, 350);
    } else {
      window.print();
    }
  };

  return (
    <>
      {/* Main Interactive Screen Modal */}
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 pb-[env(safe-area-inset-bottom)] sm:pb-0 animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0">
          {/* Mobile Drag Indicator */}
          <div className="sm:hidden pt-2 pb-1 bg-slate-900 flex justify-center">
            <div className="w-10 h-1 bg-slate-600 rounded-full" />
          </div>

          {/* Modal Header */}
          <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-start justify-between relative">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-[#EA580C] text-white flex items-center justify-center text-xl sm:text-2xl font-black shadow-lg border-2 border-white/20 flex-shrink-0">
                {student.lastName.slice(0, 1)}
                {student.firstName.slice(0, 1)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-orange-400">
                    Dossier étudiant
                  </span>
                  <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full font-mono text-slate-300">
                    {student.matricule}
                  </span>
                </div>
                <h2 className="text-lg sm:text-2xl font-black tracking-tight mt-0.5 truncate">
                  {student.lastName} {student.firstName}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-300 flex items-center gap-1.5 sm:gap-2 mt-0.5 truncate">
                  <span>{student.programName}</span>
                  <span>•</span>
                  <span>{student.levelName}</span>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors shrink-0 ml-2 cursor-pointer"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6">
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-orange-50/70 border border-orange-200/60">
                <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Absences non justifiées
                </span>
                <p className="text-xl sm:text-2xl font-black text-[#EA580C] mt-1">
                  {student.annualAbsenceCount} {student.annualAbsenceCount <= 1 ? 'absence' : 'absences'}
                </p>
                <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                  {(student.justifiedAbsenceCount ?? 0) > 0 
                    ? `+ ${student.justifiedAbsenceCount} absence${(student.justifiedAbsenceCount ?? 0) > 1 ? 's' : ''} justifiée${(student.justifiedAbsenceCount ?? 0) > 1 ? 's' : ''}`
                    : '0 absence justifiée'}
                </p>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Statut assiduité
                </span>
                <p className={`text-xs sm:text-sm font-bold mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${
                  student.annualAbsenceCount > 6
                    ? 'bg-rose-100 text-rose-700'
                    : student.annualAbsenceCount > 3
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {student.annualAbsenceCount > 6 ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Seuil critique dépassé
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Situation régulière
                    </>
                  )}
                </p>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Matières affectées
                </span>
                <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                  {subjectBreakdown.length}
                </p>
                <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">cours impactés</p>
              </div>
            </div>

            {/* Breakdown by subject */}
            {subjectBreakdown.length > 0 && (
              <div>
                <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Répartition des absences par matière
                </h4>
                <div className="space-y-1.5">
                  {subjectBreakdown.map(item => (
                    <div key={item.id} className="p-2.5 sm:p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <BookOpen className="w-4 h-4 text-[#EA580C] shrink-0" />
                        <span className="font-bold text-slate-800 truncate">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="px-2 py-0.5 rounded bg-orange-100 text-[#EA580C] font-bold">
                          {item.count} absence{item.count > 1 ? 's' : ''}
                        </span>
                        {item.justifiedCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold text-[10px] border border-emerald-200/60">
                            {item.justifiedCount} justifiée{item.justifiedCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Chronological Absences History */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                  Historique chronologique des absences
                </h4>
                <span className="text-[11px] sm:text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  {student.recentAbsences?.length || 0} enregistrement{(student.recentAbsences?.length || 0) > 1 ? 's' : ''}
                </span>
              </div>

              {student.recentAbsences && student.recentAbsences.length > 0 ? (
                <div className="space-y-2 max-h-60 sm:max-h-72 overflow-y-auto pr-1">
                  {student.recentAbsences.map(abs => {
                    const sub = getSubjectForAbsence(abs);
                    return (
                      <div 
                        key={abs.id}
                        className="p-3 sm:p-3.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50/70 transition-colors flex items-center justify-between text-xs gap-2 sm:gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="text-[#EA580C] bg-orange-50 p-2 sm:p-2.5 rounded-xl flex-shrink-0 border border-orange-100">
                            <Calendar className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate text-xs">{sub ? sub.name : 'Matière spécifique'}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] sm:text-[11px] text-slate-400">
                              <span>Saisie par {abs.recordedBy}</span>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => handleToggleAbsenceJustified(abs.id)}
                                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer transition-colors ${
                                  abs.justified
                                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                                    : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                                }`}
                                title={abs.justified ? 'Cliquer pour annuler la justification' : 'Cliquer pour marquer comme justifiée'}
                              >
                                <CheckCircle className="w-3 h-3" />
                                <span>{abs.justified ? 'Justifiée' : 'Non justifiée'}</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="font-bold text-slate-800 block text-xs">{formatFrenchDate(abs.absenceDate)}</span>
                          <span className="text-[10px] sm:text-[11px] text-slate-400 font-mono">{abs.absenceTime}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center bg-slate-50 rounded-xl text-slate-400 text-xs">
                  Aucune absence enregistrée pour cet étudiant.
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <button
                type="button"
                onClick={handleExportPDF}
                disabled={isExportingPDF}
                className="px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 active:bg-orange-800 disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[44px] sm:min-h-0 shadow-xs"
              >
                {isExportingPDF ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Génération PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Télécharger en PDF</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-[44px] sm:min-h-0"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Imprimer la fiche</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer min-h-[44px] sm:min-h-0 text-center"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

