export function suppressibleDialog(entity, message, title, suppress) {
    if (suppress) {
        return;
    }
    foundry.applications.api.DialogV2.prompt({
        window: {title},
        content: message,
        ok: {
            label: "Ok",
            icon: "fas fa-check"
        }
    });
}
