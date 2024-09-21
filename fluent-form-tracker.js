<script>
(function($) {
    var formId = document.querySelector('form.frm-fluent-form').getAttribute('data-form_id');  // Dynamically get form_id
    var formFieldsFilled = {}; // Track fields that have been filled
    var isFormSubmitted = false; // Flag to check if the form is submitted

    // List of common field names that are considered sensitive
    var sensitiveFieldNames = ['email', 'phone', 'mobile', 'contact', 'telephone'];

    // Function to hash sensitive field values (SHA-256 hashing)
    function hashValue(value) {
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then(hashBuffer => {
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        });
    }

    // Function to check if a field is sensitive based on name or value pattern
    function isSensitiveField(fieldName, fieldValue) {
        var lowerCaseName = fieldName.toLowerCase();
        var isNameSensitive = sensitiveFieldNames.some(function(name) {
            return lowerCaseName.includes(name);
        });

        var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;  // Basic email pattern
        var phonePattern = /^\+?[0-9\s-]{7,15}$/;         // Basic phone number pattern

        var isValueSensitive = emailPattern.test(fieldValue) || phonePattern.test(fieldValue);
        return isNameSensitive || isValueSensitive;
    }

    // Track field blur events to push filled field data to the dataLayer
    $('form.frm-fluent-form').find('input, textarea, select').each(function() {
        var fieldName = this.name;

        $(this).on('blur', async function() {
            var fieldValue = $(this).val();

            if (fieldValue) {
                var formattedFieldName = fieldName.replace(/[\[\]]/g, '_').toLowerCase(); // Format the field name
                var eventName = `fluent_form_${formattedFieldName}_filled`;

                if (isSensitiveField(fieldName, fieldValue)) {
                    fieldValue = await hashValue(fieldValue);  // Hash sensitive field values
                }

                formFieldsFilled[formattedFieldName] = fieldValue;

                window.dataLayer = window.dataLayer || [];
                dataLayer.push({
                    event: eventName,
                    form_id: formId, // Capture Form ID via JS variable
                    field_name: fieldName,
                    field_value: fieldValue
                });
            }
        });
    });

    // Track form submission success
    $('form.frm-fluent-form').on('fluentform_submission_success', function() {
        isFormSubmitted = true;
        var formData = new FormData(this);
        var inputValues = {};

        formData.forEach(async function(value, key) {
            var keyFormatted = key.replace(/[\[\]]/g, '_').toLowerCase();
            if (isSensitiveField(key, value)) {
                value = await hashValue(value);  // Hash sensitive value
            }
            inputValues[keyFormatted] = value;
        });

        window.dataLayer = window.dataLayer || [];
        dataLayer.push({
            event: 'fluent_form_submit',
            form_id: formId,  // Capture Form ID via JS variable
            inputs: inputValues
        });
    });

    // Detect form abandonment when the user attempts to leave the page
    $(window).on('beforeunload', async function() {
        if (!isFormSubmitted && Object.keys(formFieldsFilled).length > 0) {
            var abandonedFields = {};

            for (let fieldName in formFieldsFilled) {
                let fieldValue = formFieldsFilled[fieldName];
                if (isSensitiveField(fieldName, fieldValue)) {
                    fieldValue = await hashValue(fieldValue); // Hash sensitive values
                }
                abandonedFields[fieldName] = fieldValue;
            }

            window.dataLayer = window.dataLayer || [];
            dataLayer.push({
                event: 'fluent_form_abandoned',
                form_id: formId,  // Capture Form ID via JS variable
                abandoned_fields: abandonedFields
            });
        }
    });
})(jQuery);
</script>
