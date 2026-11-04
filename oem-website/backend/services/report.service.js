'use strict';

const reports = [
  {
    id: 'vehicle-sales-purchases',
    name: 'Vehicle Sales & Purchases',
    columns: [
      'transaction_id',
      'transaction_date',
      'transaction_type',
      'vehicle_id',
      'brand',
      'model',
      'customer_name',
      'amount',
      'payment_status'
    ]
  },
  {
    id: 'service-transactions',
    name: 'Service Transactions',
    columns: [
      'service_id',
      'transaction_date',
      'vehicle_id',
      'customer_name',
      'service_type',
      'technician',
      'labor_cost',
      'parts_cost',
      'total_amount',
      'status'
    ]
  },
  {
    id: 'spare-parts-sales-purchases',
    name: 'Spare Parts Sales & Purchases',
    columns: [
      'transaction_id',
      'transaction_date',
      'transaction_type',
      'part_id',
      'part_name',
      'quantity',
      'unit_price',
      'supplier_or_customer',
      'total_amount'
    ]
  },
  {
    id: 'insurance-renewals',
    name: 'Insurance Renewals',
    columns: [
      'renewal_id',
      'transaction_date',
      'customer_name',
      'vehicle_id',
      'insurer',
      'policy_number',
      'premium_amount',
      'expiry_date',
      'renewal_status'
    ]
  }
];

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function makeRow(reportId, index, date) {
  const n = index + 1;
  const transactionDate = formatDate(date);
  const customer = `Customer ${String(n).padStart(3, '0')}`;
  const vehicleId = `VEH-${String(n).padStart(4, '0')}`;

  const amount = Number(
    (1500 + ((n * 137) % 45000)).toFixed(2)
  );

  switch (reportId) {

    case 'vehicle-sales-purchases':
      return {
        transaction_id: `VTX-${String(n).padStart(5, '0')}`,
        transaction_date: transactionDate,
        transaction_type: n % 4 === 0 ? 'PURCHASE' : 'SALE',
        vehicle_id: vehicleId,
        brand: ['Toyota', 'Honda', 'Hyundai', 'Tata', 'Maruti'][n % 5],
        model: ['Corolla', 'City', 'Creta', 'Nexon', 'Swift'][n % 5],
        customer_name: customer,
        amount,
        payment_status: n % 3 === 0 ? 'PENDING' : 'PAID'
      };

    case 'service-transactions': {
      const labor = Number(
        (500 + ((n * 43) % 5000)).toFixed(2)
      );

      const parts = Number(
        (200 + ((n * 61) % 7000)).toFixed(2)
      );

      return {
        service_id: `SRV-${String(n).padStart(5, '0')}`,
        transaction_date: transactionDate,
        vehicle_id: vehicleId,
        customer_name: customer,
        service_type: [
          'General Service',
          'Oil Change',
          'Brake Repair',
          'Inspection'
        ][n % 4],
        technician: `Technician ${((n - 1) % 8) + 1}`,
        labor_cost: labor,
        parts_cost: parts,
        total_amount: Number((labor + parts).toFixed(2)),
        status: n % 5 === 0 ? 'IN_PROGRESS' : 'COMPLETED'
      };
    }

    case 'spare-parts-sales-purchases': {
      const quantity = (n % 8) + 1;

      const unitPrice = Number(
        (100 + ((n * 29) % 2500)).toFixed(2)
      );

      return {
        transaction_id: `PTX-${String(n).padStart(5, '0')}`,
        transaction_date: transactionDate,
        transaction_type: n % 3 === 0 ? 'PURCHASE' : 'SALE',
        part_id: `PART-${String((n % 80) + 1).padStart(3, '0')}`,
        part_name: [
          'Oil Filter',
          'Brake Pad',
          'Air Filter',
          'Spark Plug',
          'Battery'
        ][n % 5],
        quantity,
        unit_price: unitPrice,
        supplier_or_customer:
          n % 3 === 0
            ? `Supplier ${((n - 1) % 12) + 1}`
            : customer,
        total_amount: Number(
          (quantity * unitPrice).toFixed(2)
        )
      };
    }

    case 'insurance-renewals': {
      const expiry = new Date(date);

      expiry.setUTCDate(
        expiry.getUTCDate() + 30
      );

      return {
        renewal_id: `INS-${String(n).padStart(5, '0')}`,
        transaction_date: transactionDate,
        customer_name: customer,
        vehicle_id: vehicleId,
        insurer: [
          'ABC Insurance',
          'National Assurance',
          'SecureDrive'
        ][n % 3],
        policy_number: `POL-${String(n).padStart(6, '0')}`,
        premium_amount: Number(
          (2500 + ((n * 113) % 15000)).toFixed(2)
        ),
        expiry_date: formatDate(expiry),
        renewal_status: n % 4 === 0 ? 'PENDING' : 'RENEWED'
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

  const start = new Date(
    `${startDate}T00:00:00.000Z`
  );

  const end = new Date(
    `${endDate}T23:59:59.999Z`
  );

  const dataStart = new Date(
    '2026-01-01T00:00:00.000Z'
  );

  // Generate 300 synthetic daily records.
  for (let index = 0; index < 300; index += 1) {
    const date = new Date(dataStart);

    date.setUTCDate(
      date.getUTCDate() + index
    );

    if (date >= start && date <= end) {
      rows.push(
        makeRow(report.id, index, date)
      );
    }
  }

  return rows;
}

function applyScenario(rows, columns, scenario) {

  // Return an empty report.
  if (scenario === 'empty') {
    return {
      rows: [],
      columns
    };
  }

  // Introduce missing values.
  if (scenario === 'missing') {
    const changed = rows.map(
      (row) => ({ ...row })
    );

    if (changed.length > 0) {
      changed[0][columns[1]] = '';
    }

    if (changed.length > 1 && columns.length > 5) {
      changed[1][columns[5]] = '';
    }

    return {
      rows: changed,
      columns
    };
  }

  // Add a duplicate record.
  if (scenario === 'duplicates') {
    return {
      rows: rows.length
        ? [...rows, { ...rows[0] }]
        : rows,
      columns
    };
  }

  // Introduce unexpected column names.
  if (scenario === 'bad-columns') {
    return {
      rows: rows.map((row, index) => ({
        unexpected_id: `BAD-${index + 1}`,
        unexpected_value: row[columns[0]] ?? ''
      })),
      columns: [
        'unexpected_id',
        'unexpected_value'
      ]
    };
  }

  // Normal report data.
  return {
    rows,
    columns
  };
}

function getReportData(reportId, query) {
  const report = reports.find(
    (item) => item.id === reportId
  );

  if (!report) {
    return {
      status: 404,
      error: 'Report not found.'
    };
  }

  const {
    startDate,
    endDate,
    scenario = 'normal'
  } = query;

  if (
    !isValidDate(startDate) ||
    !isValidDate(endDate)
  ) {
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
    return {
      status: 400,
      error: 'Invalid test scenario.'
    };
  }

  const rows = buildRows(
    report,
    startDate,
    endDate
  );

  const data = applyScenario(
    rows,
    report.columns,
    scenario
  );

  return {
    data: {
      report,
      ...data
    }
  };
}

module.exports = {
  reports,
  getReportData
};
