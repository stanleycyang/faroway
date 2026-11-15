"""Narrow handling of optional system UI encountered during physical QA."""


def password_save_decline(nodes):
    """Return only the decline action for the observed 1Password save prompt."""
    labels = [' '.join(node.get('text', '').split()).casefold() for node in nodes]
    if not any(label == 'save username and password to 1password?' for label in labels):
        return None
    return next((node for node, label in zip(nodes, labels)
                 if label == 'no thanks' and node.get('enabled') == 'true'), None)
