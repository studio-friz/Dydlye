import requests

def test_get_root_path_returns_200_html():
    base_url = "http://localhost:8080"
    try:
        response = requests.get(f"{base_url}/", timeout=30)
        assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
        content_type = response.headers.get("Content-Type", "")
        assert "text/html" in content_type.lower(), f"Expected content type to include 'text/html' but got '{content_type}'"
        assert response.text.strip() != "", "Expected non-empty HTML response body"
    except requests.RequestException as e:
        assert False, f"Request to root path failed with exception: {e}"

test_get_root_path_returns_200_html()