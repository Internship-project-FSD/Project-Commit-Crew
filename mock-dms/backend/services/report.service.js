'use strict';

const reports = [
  {
    id: 'vehicle-sales-purchases',
    reportName: 'vehicle_sales',
    name: 'Vehicle Sales & Purchases',
    columns: [
      'InvoiceNo',
      'InvoiceDate',
      'CustomerName',
      'VehicleModel',
      'Variant',
      'Color',
      'ChassisNo',
      'EngineNo',
      'SaleAmount',
      'TaxAmount',
      'TotalAmount',
      'PaymentMode',
      'Salesperson'
    ]
  },
  {
    id: 'service-transactions',
    reportName: 'service_transactions',
    name: 'Service Transactions',
    columns: [
      'JobCardNo',
      'JobCardDate',
      'CustomerName',
      'VehicleRegNo',
      'VehicleModel',
      'ServiceType',
      'LabourAmount',
      'PartsAmount',
      'TotalAmount',
      'ServiceAdvisor',
      'Status'
    ]
  },
  {
    id: 'spare-parts-sales-purchases',
    reportName: 'spare_parts',
    name: 'Spare Parts Sales & Purchases',
    columns: [
      'PartNo',
      'PartName',
      'Category',
      'Quantity',
      'UnitPrice',
      'TotalPrice',
      'InvoiceNo',
      'InvoiceDate',
      'CustomerName'
    ]
  },
  {
    id: 'insurance-renewals',
    reportName: 'insurance_renewals',
    name: 'Insurance Renewals',
    columns: [
      'PolicyNo',
      'CustomerName',
      'VehicleRegNo',
      'VehicleModel',
      'Insurer',
      'PremiumAmount',
      'PolicyStart',
      'PolicyEnd',
      'RenewalStatus'
    ]
  }
];

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function makeRow(reportId, index, date) {
  const n = index + 1;
  const transactionDate = formatDate(date);
  const dateCode = transactionDate.replace(/-/g, '');
  const uniqueId = `${dateCode}-${String(n).padStart(5, '0')}`;
  const customer = `Customer ${String(n).padStart(3, '0')}`;
  const vehicleId = `KL-${String((n % 99) + 1).padStart(2, '0')}-AB-${String(n).padStart(4, '0')}`;

  switch (reportId) {
    case 'vehicle-sales-purchases': {
      const sale = Number((150000 + ((n * 137) % 450000)).toFixed(2));
      const tax = Number((sale * 0.18).toFixed(2));

      return {
        InvoiceNo: `INV-${uniqueId}`,
        InvoiceDate: transactionDate,
        CustomerName: customer,
        VehicleModel: ['Corolla', 'City', 'Creta', 'Nexon', 'Swift'][n % 5],
        Variant: ['Base', 'Mid', 'Top'][n % 3],
        Color: ['White', 'Black', 'Silver', 'Blue'][n % 4],
        ChassisNo: `CHS${String(n).padStart(12, '0')}`,
        EngineNo: `ENG${String(n).padStart(10, '0')}`,
        SaleAmount: sale,
        TaxAmount: tax,
        TotalAmount: Number((sale + tax).toFixed(2)),
        PaymentMode: ['UPI', 'Card', 'Bank Transfer', 'Cash'][n % 4],
        Salesperson: `Salesperson ${((n - 1) % 8) + 1}`
      };
    }

    case 'service-transactions': {
      const labour = Number((500 + ((n * 43) % 5000)).toFixed(2));
      const parts = Number((200 + ((n * 61) % 7000)).toFixed(2));

      return {
        JobCardNo: `JC-${uniqueId}`,
        JobCardDate: transactionDate,
        CustomerName: customer,
        VehicleRegNo: vehicleId,
        VehicleModel: ['Corolla', 'City', 'Creta', 'Nexon', 'Swift'][n % 5],
        ServiceType: ['General Service', 'Oil Change', 'Brake Repair', 'Inspection'][n % 4],
        LabourAmount: labour,
        PartsAmount: parts,
        TotalAmount: Number((labour + parts).toFixed(2)),
        ServiceAdvisor: `Advisor ${((n - 1) % 8) + 1}`,
        Status: n % 5 === 0 ? 'IN_PROGRESS' : 'COMPLETED'
      };
    }

    case 'spare-parts-sales-purchases': {
      const quantity = (n % 8) + 1;
      const unitPrice = Number((100 + ((n * 29) % 2500)).toFixed(2));

      return {
        PartNo: `PART-${String((n % 80) + 1).padStart(3, '0')}`,
        PartName: ['Oil Filter', 'Brake Pad', 'Air Filter', 'Spark Plug', 'Battery'][n % 5],
        Category: ['Engine', 'Brakes', 'Electrical', 'Maintenance'][n % 4],
        Quantity: quantity,
        UnitPrice: unitPrice,
        TotalPrice: Number((quantity * unitPrice).toFixed(2)),
        InvoiceNo: `PART-INV-${uniqueId}`,
        InvoiceDate: transactionDate,
        CustomerName: customer
      };
    }

    case 'insurance-renewals': {
      const policyEnd = new Date(date);
      policyEnd.setUTCDate(policyEnd.getUTCDate() + 365);

      const policyStart = new Date(date);
      policyStart.setUTCDate(policyStart.getUTCDate() - 1);

      return {
        PolicyNo: `POL-${uniqueId}`,
        CustomerName: customer,
        VehicleRegNo: vehicleId,
        VehicleModel: ['Corolla', 'City', 'Creta', 'Nexon', 'Swift'][n % 5],
        Insurer: ['ABC Insurance', 'National Assurance', 'SecureDrive'][n % 3],
        PremiumAmount: Number((2500 + ((n * 113) % 15000)).toFixed(2)),
        PolicyStart: formatDate(policyStart),
        PolicyEnd: formatDate(policyEnd),
        RenewalStatus: n % 4 === 0 ? 'PENDING' : 'RENEWED'
      };
    }

    default:
      return null;
  }
}

function isValidDate(value) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function buildRows(report, startDate, endDate) {
  const rows = [];

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  const dataStart = new Date(start);

  // Generate up to 200 synthetic records per report.
  for (let index = 0; index < 300 && rows.length < 200; index += 1) {
    const date = new Date(dataStart);
    date.setUTCDate(date.getUTCDate() + index);

    if (date >= start && date <= end) {
      rows.push(makeRow(report.id, index, date));
    }
  }

  return rows;
}

function applyScenario(rows, columns, scenario) {
  if (scenario === 'empty') {
    return { rows: [], columns };
  }

  if (scenario === 'missing') {
    const changed = rows.map(row => ({ ...row }));

    if (changed.length > 0) {
      changed[0][columns[1]] = '';
    }

    if (changed.length > 1 && columns.length > 5) {
      changed[1][columns[5]] = '';
    }

    return { rows: changed, columns };
  }

  if (scenario === 'duplicates') {
    return {
      rows: rows.length ? [...rows, { ...rows[0] }] : rows,
      columns
    };
  }

  if (scenario === 'bad-columns') {
    return {
      rows: rows.map((row, index) => ({
        unexpected_id: `BAD-${index + 1}`,
        unexpected_value: row[columns[0]] ?? ''
      })),
      columns: ['unexpected_id', 'unexpected_value']
    };
  }

  return { rows, columns };
}

function getReportData(reportId, query) {
  const report = reports.find(item => item.id === reportId);

  if (!report) {
    return { status: 404, error: 'Report not found.' };
  }

  const {
    startDate,
    endDate,
    scenario = 'normal'
  } = query;

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return {
      status: 400,
      error: 'Provide valid start and end dates in YYYY-MM-DD format.'
    };
  }

  if (startDate > endDate) {
    return {
      status: 400,
      error: 'Start date must be on or before end date.'
    };
  }

  const allowedScenarios = [
    'normal',
    'missing',
    'duplicates',
    'empty',
    'bad-columns'
  ];

  if (!allowedScenarios.includes(scenario)) {
    return { status: 400, error: 'Invalid test scenario.' };
  }

  const rows = buildRows(report, startDate, endDate);
  const data = applyScenario(rows, report.columns, scenario);

  return {
    data: {
      report,
      ...data
    }
  };
}

module.exports = {reports, getReportData};
