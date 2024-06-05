const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'React POST Request Example' })
};
const response = await fetch('https://reqres.in/api/posts', requestOptions);
const data = await response.json();
this.setState({ postId: data.id });