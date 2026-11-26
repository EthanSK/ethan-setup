"""Check the scheduled refresh token stays on the exact public GitHub tree request. — GPT-6.1 Sol"""

import importlib.util
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch
from urllib.request import HTTPRedirectHandler

script = Path(__file__).resolve().parents[1] / 'scripts' / 'sync-sources.py'
spec = importlib.util.spec_from_file_location('sync_sources_auth', script)
assert spec is not None and spec.loader is not None
sync_sources = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync_sources)
TREE_URL = 'https://api.github.com/repos/EthanSK/agentic-mouse/git/trees/' + 'a' * 40 + '?recursive=1'


class SourceAuthenticationTests(unittest.TestCase):
    def test_token_is_only_on_the_exact_tree_request_and_dropped_on_redirect(self) -> None:
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'published data'
        with patch.dict('os.environ', {'SOURCE_SYNC_GITHUB_TOKEN': 'test-only-token'}):
            with patch.object(sync_sources.urllib.request, 'urlopen', return_value=response) as open_url:
                for url in [TREE_URL, sync_sources.PUBLIC_MOUSE + 'simulator-data.json', sync_sources.PUBLIC_DESKTOP + 'desktop/apps.json', TREE_URL + '&other=1', TREE_URL.replace('api.github.com', 'example.com')]:
                    self.assertEqual(sync_sources.read(url), b'published data')
        tree_request, *public_requests = [call.args[0] for call in open_url.call_args_list]
        self.assertEqual(tree_request.get_header('Authorization'), 'Bearer test-only-token')
        for request in public_requests:
            self.assertIsNone(request.get_header('Authorization'), request.full_url)
        for target in ('https://api.github.com/redirected', 'https://example.com/redirected'):
            redirect = HTTPRedirectHandler().redirect_request(tree_request, None, 302, 'Found', {}, target)
            self.assertIsNotNone(redirect)
            self.assertIsNone(redirect.get_header('Authorization'))

    def test_public_tree_request_can_run_without_a_token(self) -> None:
        response = MagicMock()
        response.__enter__.return_value.read.return_value = b'published data'
        with patch.dict('os.environ', clear=True):
            with patch.object(sync_sources.urllib.request, 'urlopen', return_value=response) as open_url:
                self.assertEqual(sync_sources.read(TREE_URL), b'published data')
        self.assertIsNone(open_url.call_args.args[0].get_header('Authorization'))
