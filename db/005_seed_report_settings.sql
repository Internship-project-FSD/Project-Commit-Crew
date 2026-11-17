UPDATE report_configs
SET
  download_folder = 'downloads/incoming',
  date_strategy = 'yesterday',
  portal_path = CASE report_name
    WHEN 'vehicle_sales' THEN 'vehicle-sales-purchases'
    WHEN 'service_transactions' THEN 'service-transactions'
    WHEN 'spare_parts' THEN 'spare-parts-sales-purchases'
    WHEN 'insurance_renewals' THEN 'insurance-renewals'
  END
WHERE report_name IN (
  'vehicle_sales',
  'service_transactions',
  'spare_parts',
  'insurance_renewals'
);
