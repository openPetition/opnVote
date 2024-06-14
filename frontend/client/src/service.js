const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'React POST Request Example' })
};
const response = await fetch('http://37.120.169.119:8000/subgraphs/name/opnvote-002/', requestOptions);
const data = await response.json();
this.setState({ postId: data.id });