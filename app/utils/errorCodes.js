export default errorCodes = {
  '6700': 'Wrong or inconsistent APDU length.',
  '6985': 'Wrapped chained command or multiple pass command ongoing.',
  '6a82': 'Application or file not found, currently selected application remains selected.',
  '6a86': 'Wrong parameter P1 and/or P2',
  '6a87': 'Wrong parameter Lc inconsistent with P1-P2',
  '6e00': 'Wrong CLA',
  '6581': 'Memory failure',
  '6982': 'Security status not satisfied',
  '91ca': 'COMMAND_ABORTED',
  '917e': 'LENGTH_ERROR',
  '919e': 'PARAMETER_ERROR',
  '9140': 'NO_SUCH_KEY',
  '919d': 'PERMISSION_DENIED',
  '91ad': 'AUTHENTICATION_DELAY',
  '911e': 'INTEGRITY_ERROR',
  '91f0': 'FILE_NOT_FOUND',
  '91ae': 'AUTHENTICATION_ERROR',
  '91ee': 'MEMORY_ERROR',
  '91be': 'BOUNDARY_ERROR'
};

//NOTE: when new APDU command gets added make sure the error codes are added here


export const isoSelectErrorCodes = {
  '6700' : 'Wrong or inconsistent APDU length.',
  '6985' : 'Wrapped chained command or multiple pass command ongoing.',
  '6a82' : 'Application or file not found, currently selected application remains selected.',
  '6a86' : 'Wrong parameter P1 and/or P2',
  '6a87' : 'Wrong parameter Lc inconsistent with P1-P2',
  '6e00' : 'Wrong CLA',
};


export const changeKeyErrorCodes = {
  '91ca' : 'COMMAND_ABORTED Chained command or multiple pass command ongoing.',
  '911e' : 'INTEGRITY_ERROR Integrity error in cryptogram or Invalid Secure Messaging MAC (only).',
  '917e' : 'LENGTH_ERROR Command size not allowed.',
  '919e' : 'PARAMETER_ERROR Parameter value not allowed',
  '919d' : 'PERMISSION_DENIED PICC level (MF) is selected. access right Change of targeted file has access conditions set to Fh. Enabling Secure Dynamic Messaging (FileOption Bit 6 set to 1b) is only allowed for FileNo 02h.',
  '91ae' : 'AUTHENTICATION_ERROR At application level, missing active authentication with AppMasterKey while targeting any AppKey.',
  '91ee' : 'MEMORY_ERROR Failure when reading or writing to non-volatile memory.',
};


export const changeFileSettingsErrorCodes = {
  '91ca' : 'COMMAND_ABORTED chained command or multiple pass command ongoing.',
  '911e' : 'INTEGRITY_ERROR Integrity error in cryptogram. Invalid Secure Messaging MAC (only).',
  '917e' : 'LENGTH_ERROR Command size not allowed.',
  '919e' : 'PARAMETER_ERROR Parameter value not allowed',
  '919d' : 'PERMISSION_DENIED PICC level (MF) is selected. access right Change of targeted file has access conditions set to Fh. Enabling Secure Dynamic Messaging (FileOption Bit 6 set to 1b) is only allowed for FileNo 02h.',
  '91f0' : 'FILE_NOT_FOUND F0h File with targeted FileNo does not exist for the targeted application. ',
  '91ae' : 'AUTHENTICATION_ERROR AEh File access right Change of targeted file not granted as there is no active authentication with the required key while the access conditions is different from Fh.',
  '91ee' : 'MEMORY_ERROR EEh Failure when reading or writing to non-volatile memory.',
};