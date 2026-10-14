import { Injectable } from '@angular/core';

export interface UserFacingError {
  type: 'network' | 'timeout' | 'validation' | 'auth' | 'permission' | 'server' | 'rate_limit' | 'not_found' | 'conflict' | 'upload' | 'unknown';
  message: string;
  userMessage: string;
  actionHint: string;
  statusCode?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {

  /**
   * Translates any raw error or HttpErrorResponse into a structured,
   * user-friendly error with an actionable next step.
   */
  formatError(err: any, operation: string = 'Operation', isAmharic: boolean = false): UserFacingError {
    const status = err?.status ?? 0;
    const rawMsg = err?.error?.message || err?.message || '';

    let type: UserFacingError['type'] = 'unknown';
    let message = '';
    let actionHint = '';

    if (status === 0 || err?.name === 'ProgressEvent') {
      type = 'network';
      message = isAmharic
        ? 'የበይነመረብ ግንኙነት የለም። እባክዎ ኢንተርኔትዎን ፈትሸው እንደገና ይሞክሩ።'
        : 'Please check your internet connection and try again.';
      actionHint = isAmharic ? 'ኢንተርኔትዎን ያረጋግጡ' : 'Check your internet and retry.';
    } else if (status === 408 || status === 504 || err?.name === 'TimeoutError') {
      type = 'timeout';
      message = isAmharic
        ? 'ግንኙነቱ ረጅም ጊዜ ወስዷል። እባክዎ እንደገና ይሞክሩ።'
        : 'The request took too long. Please try again.';
      actionHint = isAmharic ? 'እንደገና ይሞክሩ' : 'Try again in a moment.';
    } else if (status === 401) {
      type = 'auth';
      message = isAmharic
        ? 'እባክዎ ለመቀጠል እንደገና ይግቡ።'
        : 'Please log in again to continue.';
      actionHint = isAmharic ? 'ግባ የሚለውን ይጫኑ' : 'Log in to your account.';
    } else if (status === 403) {
      type = 'permission';
      message = isAmharic
        ? 'ይህን ገጽ ወይም ተግባር ለመፈጸም ፈቃድ የለዎትም።'
        : "You don't have access to this action.";
      actionHint = isAmharic ? 'ወደ መነሻ ገጽ ይመለሱ' : 'Switch accounts or contact support.';
    } else if (status === 404) {
      type = 'not_found';
      message = isAmharic
        ? 'የተፈለገው እቃ ወይም ገጽ አልተገኘም።'
        : 'This product or item no longer exists.';
      actionHint = isAmharic ? 'ምርቶችን ያስሱ' : 'Browse our other products.';
    } else if (status === 409) {
      type = 'conflict';
      message = isAmharic
        ? 'ይህ የክፍያ ማረጋገጫ ቁጥር አስቀድሞ ተመዝግቧል። እባክዎ የSMS ኮድዎን ያረጋግጡ።'
        : 'This transaction code or item has already been submitted. Please check your details.';
      actionHint = isAmharic ? 'የSMS ኮድዎን ያረጋግጡ' : 'Check your SMS code and retry.';
    } else if (status === 413) {
      type = 'upload';
      message = isAmharic
        ? 'የመረጡት ፋይል በጣም ትልቅ ነው። እባክዎ አነስተኛ ፎቶ ይምረጡ።'
        : 'The file is too large. Please choose a smaller photo.';
      actionHint = isAmharic ? 'አነስተኛ ፎቶ ይምረጡ' : 'Select a smaller photo or screenshot.';
    } else if (status === 429) {
      type = 'rate_limit';
      message = isAmharic
        ? 'በጣም ፈጣን ሙከራ ተደርጓል። እባክዎ ጥቂት ደቂቃዎች ቆይተው እንደገና ይሞክሩ።'
        : 'Too many attempts. Please wait a moment and try again.';
      actionHint = isAmharic ? 'ጥቂት ደቂቃ ይጠብቁ' : 'Wait a moment before retrying.';
    } else if (status >= 400 && status < 500) {
      type = 'validation';
      message = (rawMsg && !rawMsg.toLowerCase().includes('error'))
        ? rawMsg
        : (isAmharic ? 'እባክዎ ያስገቡትን መረጃ ፈትሸው እንደገና ይሞክሩ።' : 'Please check your information and try again.');
      actionHint = isAmharic ? 'የተሳሳተውን አስተካክሉ' : 'Check the fields and retry.';
    } else if (status >= 500) {
      type = 'server';
      message = isAmharic
        ? 'ያልተጠበቀ የአገልጋይ ችግር አጋጥሟል። እባክዎ ጥቂት ቆይተው እንደገና ይሞክሩ።'
        : 'Something went wrong on our end. Please try again in a few moments.';
      actionHint = isAmharic ? 'ጥቂት ቆይተው ይሞክሩ' : 'Try again in a few moments.';
    } else {
      type = 'unknown';
      message = (rawMsg && !rawMsg.toLowerCase().includes('error'))
        ? rawMsg
        : (isAmharic ? 'ያልተጠበቀ ችግር አጋጥሟል። እባክዎ እንደገና ይሞክሩ።' : 'Something went wrong. Please try again.');
      actionHint = isAmharic ? 'እንደገና ይሞክሩ' : 'Please retry.';
    }

    // Developer Diagnostic Logging (Never log passwords, tokens, or private secrets)
    this.logDiagnostic(type, operation, status, rawMsg, err);

    return { type, message, userMessage: message, actionHint, statusCode: status };
  }

  private logDiagnostic(type: string, operation: string, status: number, rawMsg: string, err: any) {
    const sanitizedError: Record<string, any> = {
      type,
      operation,
      status,
      timestamp: new Date().toISOString(),
      rawMessage: rawMsg,
      url: err?.url || undefined
    };

    // Safe error inspection for developers
    console.groupCollapsed(`%c[TeleGebeya ERROR UX] ${type} @ ${operation}`, 'color: #e11d48; font-weight: bold;');
    console.table(sanitizedError);
    if (err?.error && typeof err.error === 'object') {
      const safePayload = { ...err.error };
      delete safePayload.password;
      delete safePayload.token;
      delete safePayload.authorization;
      console.log('Sanitized Response Body:', safePayload);
    }
    console.groupEnd();
  }
}
