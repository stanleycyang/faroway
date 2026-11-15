import unittest
from native_ui import password_save_decline


class PasswordSavePromptTest(unittest.TestCase):
    def test_declines_only_the_observed_save_prompt(self):
        decline = {'text': 'No thanks', 'enabled': 'true', 'bounds': '[1,2][3,4]'}
        save = {'text': 'Save', 'enabled': 'true'}
        self.assertIs(password_save_decline([
            {'text': 'Save username and password to\n1Password?'}, save, decline
        ]), decline)

    def test_does_not_dismiss_unrelated_dialogs_or_save_credentials(self):
        self.assertIsNone(password_save_decline([
            {'text': 'Save'}, {'text': 'No thanks', 'enabled': 'true'}
        ]))
        self.assertIsNone(password_save_decline([
            {'text': 'Save username and password to 1Password?'},
            {'text': 'Save', 'enabled': 'true'},
            {'text': 'No thanks', 'enabled': 'false'},
        ]))


if __name__ == '__main__':
    unittest.main()
