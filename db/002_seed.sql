INSERT INTO report_configs (report_name, file_pattern, required_columns, unique_key, column_mapping) VALUES

('vehicle_sales', 'vehicle_sales_*.csv',
 '["InvoiceNo","InvoiceDate","CustomerName","VehicleModel","Variant","Color","ChassisNo","EngineNo","SaleAmount","TaxAmount","TotalAmount","PaymentMode","Salesperson"]',
 '["InvoiceNo"]',
 '{"InvoiceNo":"invoice_no","InvoiceDate":"invoice_date","CustomerName":"customer_name","VehicleModel":"vehicle_model","Variant":"variant","Color":"color","ChassisNo":"chassis_no","EngineNo":"engine_no","SaleAmount":"sale_amount","TaxAmount":"tax_amount","TotalAmount":"total_amount","PaymentMode":"payment_mode","Salesperson":"salesperson"}'
),

('service_transactions', 'service_transactions_*.csv',
 '["JobCardNo","JobCardDate","CustomerName","VehicleRegNo","VehicleModel","ServiceType","LabourAmount","PartsAmount","TotalAmount","ServiceAdvisor","Status"]',
 '["JobCardNo"]',
 '{"JobCardNo":"job_card_no","JobCardDate":"job_card_date","CustomerName":"customer_name","VehicleRegNo":"vehicle_reg_no","VehicleModel":"vehicle_model","ServiceType":"service_type","LabourAmount":"labour_amount","PartsAmount":"parts_amount","TotalAmount":"total_amount","ServiceAdvisor":"service_advisor","Status":"status"}'
),

('spare_parts', 'spare_parts_*.csv',
 '["PartNo","PartName","Category","Quantity","UnitPrice","TotalPrice","InvoiceNo","InvoiceDate","CustomerName"]',
 '["PartNo","InvoiceNo"]',
 '{"PartNo":"part_no","PartName":"part_name","Category":"category","Quantity":"quantity","UnitPrice":"unit_price","TotalPrice":"total_price","InvoiceNo":"invoice_no","InvoiceDate":"invoice_date","CustomerName":"customer_name"}'
),

('insurance_renewals', 'insurance_renewals_*.csv',
 '["PolicyNo","CustomerName","VehicleRegNo","VehicleModel","Insurer","PremiumAmount","PolicyStart","PolicyEnd","RenewalStatus"]',
 '["PolicyNo"]',
 '{"PolicyNo":"policy_no","CustomerName":"customer_name","VehicleRegNo":"vehicle_reg_no","VehicleModel":"vehicle_model","Insurer":"insurer","PremiumAmount":"premium_amount","PolicyStart":"policy_start","PolicyEnd":"policy_end","RenewalStatus":"renewal_status"}'
)

ON CONFLICT (report_name) DO NOTHING;
