const NOTIFICATION_RECIPIENTS = {
    hold: [
        'jangleparth2005@gmail.com',
        'purchase@ashtavinayaka.com',
        'production@ashtavinayaka.com',
        'design4@ashtavinayaka.com',
        'qc2@ashtavinayaka.com',
        'sumit.shrivastav@ashtavinayaka.com',
        'ghanshyam@ashtavinayaka.com',
        'planning@ashtavinayaka.com'
    ],
    cancel: [
        'jangleparth2005@gmail.com',
        'purchase@ashtavinayaka.com',
        'production@ashtavinayaka.com',
        'design4@ashtavinayaka.com',
        'qc2@ashtavinayaka.com',
        'sumit.shrivastav@ashtavinayaka.com',
        'ghanshyam@ashtavinayaka.com',
        'planning@ashtavinayaka.com'
    ],
    restart: [
        'jangleparth2005@gmail.com',
        'purchase@ashtavinayaka.com',
        'production@ashtavinayaka.com',
        'design4@ashtavinayaka.com',
        'qc2@ashtavinayaka.com',
        'sumit.shrivastav@ashtavinayaka.com',
        'ghanshyam@ashtavinayaka.com',
        'planning@ashtavinayaka.com'
    ]
};

const JOB_STATUS_MAP = {
    'sales_order_received': 'Sales Order Received',
    'drawing_approved': 'Drawing Approved',
    'long_lead_item_details_given': 'Long Lead Item Details Given',
    'drawing_bom_issued': 'Drawing/BOM Issued',
    'production_order_purchase_request_prepared': 'Production Order & Purchase Request Prepared',
    'rm_received': 'RM Received',
    'production_started': 'Production Started',
    'production_completed': 'Production Completed',
    'qc_clear_for_dispatch': 'QC Clear for Dispatch',
    'dispatch_clearance': 'Dispatch Clearance',
    'dispatched': 'Dispatched'
};

const DEPARTMENT_MAP = {
    'sales_order_received': 'Sales',
    'drawing_approved': 'Design',
    'long_lead_item_details_given': 'Design',
    'drawing_bom_issued': 'Planning',
    'production_order_purchase_request_prepared': 'Purchase',
    'rm_received': 'Production',
    'production_started': 'Production',
    'production_completed': 'Quality',
    'qc_clear_for_dispatch': 'Sales',
    'dispatch_clearance': 'Production',
    'dispatched': 'Logistics'
};

const STAGE_ORDER = [
    'sales_order_received',
    'drawing_approved',
    'long_lead_item_details_given',
    'drawing_bom_issued',
    'production_order_purchase_request_prepared',
    'rm_received',
    'production_started',
    'production_completed',
    'qc_clear_for_dispatch',
    'dispatch_clearance',
    'dispatched'
];

module.exports = {
    NOTIFICATION_RECIPIENTS,
    JOB_STATUS_MAP,
    DEPARTMENT_MAP,
    STAGE_ORDER
};