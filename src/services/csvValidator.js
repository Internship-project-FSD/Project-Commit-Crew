import fs from 'fs';
import { parse } from 'csv-parse/sync';

function validateCsvFile(filePath, reportConfig) {
  const requiredColumns = reportConfig.required_columns;

  let result = {
    isValid: true,
    fileError: null,
    validRows: [],
    rejectedRows: [],
    totalRows: 0
  };

  // step 1: try to read the file
  let fileContent;
  try {
    fileContent = fs.readFileSync(filePath, 'utf-8');
  } catch (err) {
    result.isValid = false;
    result.fileError = 'Cannot read file: ' + err.message;
    return result;
  }

  // step 2: check if file is empty
  if (fileContent.trim().length === 0) {
    result.isValid = false;
    result.fileError = 'File is empty';
    return result;
  }

  // step 3: try to parse the csv
  let records;
  try {
    records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
  } catch (err) {
    result.isValid = false;
    result.fileError = 'CSV parse error: ' + err.message;
    return result;
  }

  // step 4: check if there are any data rows
  if (records.length === 0) {
    result.isValid = false;
    result.fileError = 'No data rows found';
    return result;
  }

  // step 5: check if csv has all required columns
  const csvColumns = Object.keys(records[0]);
  const missingColumns = requiredColumns.filter(col => !csvColumns.includes(col));

  if (missingColumns.length > 0) {
    result.isValid = false;
    result.fileError = 'Missing columns: ' + missingColumns.join(', ');
    return result;
  }

  // step 6: check each row one by one
  result.totalRows = records.length;

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    const rowNumber = i + 2; // +2 because row 1 is the header
    const errors = [];

    // check if any required field is empty
    for (const col of requiredColumns) {
      if (!row[col] || row[col].trim() === '') {
        errors.push(col + ' is empty');
      }
    }

    if (errors.length > 0) {
      // bad row — save it to rejected list
      result.rejectedRows.push({
        rowNumber: rowNumber,
        data: row,
        reason: errors.join('; ')
      });
    } else {
      // good row
      result.validRows.push(row);
    }
  }

  return result;
}

export { validateCsvFile };
